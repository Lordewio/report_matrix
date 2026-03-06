import { NextResponse } from 'next/server'
import serverSupabase from '../../../src/lib/serverSupabase'
import { compileTasks, generatePDFReport, generateDocxReport, storeReport } from '../../../src/lib/reportEngine'
import { getUserFromAuthHeader } from '../../../src/lib/serverAuth'

const UGANDA_OFFSET_MINUTES = 3 * 60

function startOfWeekUganda(date: Date) {
  const shifted = new Date(date.getTime() + UGANDA_OFFSET_MINUTES * 60 * 1000)
  const day = shifted.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  shifted.setUTCDate(shifted.getUTCDate() + diffToMonday)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - UGANDA_OFFSET_MINUTES * 60 * 1000)
}

function startOfDayUganda(date: Date) {
  const shifted = new Date(date.getTime() + UGANDA_OFFSET_MINUTES * 60 * 1000)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - UGANDA_OFFSET_MINUTES * 60 * 1000)
}

function resolveRange(frequency?: string) {
  const now = new Date()
  const periodEnd = now
  const normalizedFrequency = (frequency || '').toLowerCase()

  let periodStart = startOfWeekUganda(periodEnd)
  if (normalizedFrequency === 'daily') {
    periodStart = startOfDayUganda(periodEnd)
  }
  if (normalizedFrequency === 'biweekly') {
    periodStart.setUTCDate(periodStart.getUTCDate() - 7)
  }
  
  return {
    rangeStart: periodStart.toISOString(),
    rangeEnd: periodEnd.toISOString(),
    dateRangeLabel: `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, area, frequency, scope } = body
    const caller = await getUserFromAuthHeader(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const filters: any = {}
    const normalizedScope = ['all', 'mine', 'department', 'user'].includes(String(scope || '')) ? String(scope) : 'all'

    if (normalizedScope === 'mine') {
      filters.userId = caller.id
    }

    if (normalizedScope === 'department') {
      if (!area) return NextResponse.json({ error: 'Department is required for department report.' }, { status: 400 })
      filters.area = area
    }

    if (normalizedScope === 'user') {
      if (!userId) return NextResponse.json({ error: 'User is required for user report.' }, { status: 400 })
      filters.userId = userId
    }

    const resolved = resolveRange(frequency)
    const normalizedStart = resolved.rangeStart
    const normalizedEnd = resolved.rangeEnd

    const grouped = await compileTasks(normalizedStart, normalizedEnd, filters)
    const totalTasks = Object.values(grouped).reduce((sum, rows) => sum + rows.length, 0)
    const dateRangeLabel = resolved.dateRangeLabel

    const normalizedFrequency = ['daily', 'weekly', 'biweekly'].includes(String(frequency || '').toLowerCase())
      ? String(frequency).toLowerCase()
      : 'weekly'

    const baseTitle = normalizedFrequency === 'daily'
      ? 'Daily Report'
      : normalizedFrequency === 'biweekly'
        ? 'Bi-weekly Report'
        : 'Weekly Report'
    const scopeLabel =
      normalizedScope === 'mine'
        ? 'My Tasks'
        : normalizedScope === 'department'
          ? `Department: ${area}`
          : normalizedScope === 'user'
            ? 'Particular User'
            : 'General'
    const title = `${baseTitle} - ${scopeLabel}`
    const pdfBytes = await generatePDFReport(grouped, title, { dateRangeLabel, totalTasks })

    const timestamp = Date.now()
    const pdfName = `reports/${title.toLowerCase().replace(/\s+/g,'-')}-${timestamp}.pdf`
    const docxName = `reports/${title.toLowerCase().replace(/\s+/g,'-')}-${timestamp}.docx`

    const pdfRes = await storeReport(Buffer.from(pdfBytes), pdfName, 'application/pdf', { generatedBy: caller.id, startDate: normalizedStart || null, endDate: normalizedEnd || null, frequency: normalizedFrequency })

    let docxRes: { url: string; meta: any } | null = null
    let docxError: string | null = null
    try {
      const docxBytes = await generateDocxReport(grouped, title, { dateRangeLabel, totalTasks })
      docxRes = await storeReport(Buffer.from(docxBytes), docxName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { generatedBy: caller.id, startDate: normalizedStart || null, endDate: normalizedEnd || null, frequency: normalizedFrequency })
    } catch (err: any) {
      docxError = err?.message || String(err)
    }

    return NextResponse.json({ pdfUrl: pdfRes.url, docxUrl: docxRes?.url, pdfMeta: pdfRes.meta, docxMeta: docxRes?.meta, docxError, totalTasks, scope: normalizedScope, period: { start: normalizedStart, end: normalizedEnd, label: dateRangeLabel } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
