import { PDFDocument, StandardFonts } from 'pdf-lib'
import serverSupabase from './serverSupabase'

type TaskRow = {
  id: string
  title: string
  description: string
  reporting_area: string
  created_at: string
  author_id?: string | null
  author_name: string
}

export async function compileTasks(startDate: string, endDate: string, filters: { userId?: string; area?: string } = {}) {
  const applyFilters = (query: any) => {
    if (startDate) query.gte('created_at', startDate)
    if (endDate) query.lte('created_at', endDate)
    if (filters.userId) query.eq('author_id', filters.userId)
    if (filters.area) query.eq('reporting_area', filters.area)
    return query
  }

  let q = await applyFilters(
    serverSupabase
      .from('tasks')
      .select('id, title, description, reporting_area, created_at, author_id, users(name,email)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  )

  if (q.error) {
    q = await applyFilters(
      serverSupabase
        .from('tasks')
        .select('id, title, description, reporting_area, created_at, author_id, users(name,email)')
        .order('created_at', { ascending: false })
    )
  }

  if (q.error) {
    q = await applyFilters(
      serverSupabase
        .from('tasks')
        .select('id, title, description, reporting_area, created_at, author_id')
        .order('created_at', { ascending: false })
    )
  }

  if (q.error) throw q.error

  const rows = q.data || []
  const authorIds = Array.from(new Set((rows || []).map((r: any) => r.author_id).filter(Boolean)))

  let usersById: Record<string, { name: string | null; email: string | null }> = {}
  if (authorIds.length > 0) {
    const usersRes = await serverSupabase
      .from('users')
      .select('id,name,email')
      .in('id', authorIds)

    if (!usersRes.error) {
      usersById = (usersRes.data || []).reduce((acc: Record<string, { name: string | null; email: string | null }>, user: any) => {
        acc[user.id] = { name: user.name || null, email: user.email || null }
        return acc
      }, {})
    }
  }

  const tasks: TaskRow[] = (rows || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    reporting_area: r.reporting_area,
    created_at: r.created_at,
    author_id: r.author_id || null,
    author_name:
      r.author_name ||
      r.users?.name ||
      r.users?.email ||
      usersById[r.author_id]?.name ||
      usersById[r.author_id]?.email ||
      (r.author_id ? `User ${String(r.author_id).slice(0, 8)}` : 'User')
  }))

  // Group by area
  const grouped: Record<string, TaskRow[]> = {}
  for (const t of tasks) {
    if (!grouped[t.reporting_area]) grouped[t.reporting_area] = []
    grouped[t.reporting_area].push(t)
  }

  return grouped
}

export async function generatePDFReport(
  grouped: Record<string, TaskRow[]>,
  title = 'Report',
  summary: { dateRangeLabel?: string; totalTasks?: number } = {}
) {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage()
  let { width, height } = page.getSize()
  let font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  let y = height - 40
  page.drawText(title, { x: 40, y, size: 18, font })
  y -= 28

  if (summary.dateRangeLabel) {
    page.drawText(`Date range: ${summary.dateRangeLabel}`, { x: 40, y, size: 10, font })
    y -= 16
  }
  if (typeof summary.totalTasks === 'number') {
    page.drawText(`Total tasks: ${summary.totalTasks}`, { x: 40, y, size: 10, font })
    y -= 16
  }

  const areas = Object.entries(grouped)
  if (areas.length === 0) {
    page.drawText('No tasks found for the selected filters and date range.', { x: 40, y, size: 11, font })
    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  }

  for (const [area, tasks] of areas) {
    if (y < 100) {
      page = pdfDoc.addPage()
      ;({ width, height } = page.getSize())
      font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      y = height - 40
    }
    page.drawText(area, { x: 40, y, size: 14, font })
    y -= 20
    for (const t of tasks) {
      if (y < 120) {
        page = pdfDoc.addPage()
        ;({ width, height } = page.getSize())
        font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        y = height - 40
      }
      const line = `${t.created_at.split('T')[0]} • ${t.author_name} — ${t.title}`
      page.drawText(line, { x: 48, y, size: 10, font })
      y -= 14
      const desc = (t.description || '').slice(0, 200)
      page.drawText(desc, { x: 56, y, size: 9, font })
      y -= 22
    }
    y -= 12
  }
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

export async function generateDocxReport(
  grouped: Record<string, TaskRow[]>,
  title = 'Report',
  summary: { dateRangeLabel?: string; totalTasks?: number } = {}
) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const children = [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })] })
  ]

  if (summary.dateRangeLabel) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Date range: ${summary.dateRangeLabel}` })] }))
  }
  if (typeof summary.totalTasks === 'number') {
    children.push(new Paragraph({ children: [new TextRun({ text: `Total tasks: ${summary.totalTasks}` })] }))
  }

  if (Object.keys(grouped).length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'No tasks found for the selected filters and date range.' })] }))
  }

  for (const [area, tasks] of Object.entries(grouped)) {
    children.push(new Paragraph({ children: [new TextRun({ text: area, bold: true })] }))
    for (const t of tasks) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: `${t.created_at.split('T')[0]} • ${t.author_name} — ${t.title}` })] })
      )
      children.push(new Paragraph({ children: [new TextRun({ text: t.description || '' })] }))
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }]
  })
  const buffer = await Packer.toBuffer(doc)
  return buffer
}

export async function storeReport(
  bytes: Uint8Array | Buffer,
  filename: string,
  contentType = 'application/pdf',
  meta: { generatedBy?: string | null; startDate?: string | null; endDate?: string | null; frequency?: string | null } = {}
) {
  const bucket = process.env.SUPABASE_REPORTS_BUCKET || 'reports'

  const bucketCheck = await serverSupabase.storage.getBucket(bucket)
  if (bucketCheck.error) {
    const createRes = await serverSupabase.storage.createBucket(bucket, { public: true })
    if (createRes.error && !createRes.error.message.toLowerCase().includes('already')) {
      throw createRes.error
    }
  }

  const { data, error } = await serverSupabase.storage.from(bucket).upload(filename, bytes, {
    contentType,
    upsert: true
  })
  if (error) throw error
  const publicUrl = serverSupabase.storage.from(bucket).getPublicUrl(filename).data.publicUrl

  // Store metadata in reports table using service role
  const insert = await serverSupabase.from('reports').insert([{ filename, url: publicUrl, content_type: contentType, generated_by: meta.generatedBy || null, start_date: meta.startDate || null, end_date: meta.endDate || null, frequency: meta.frequency || null }])
  if (insert.error) throw insert.error
  return { url: publicUrl, meta: insert.data?.[0] }
}
