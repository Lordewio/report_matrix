import { NextResponse } from 'next/server'
import serverSupabase from '../../../../src/lib/serverSupabase'
import { getUserFromAuthHeader } from '../../../../src/lib/serverAuth'

async function ensureAdmin(req: Request) {
  const caller = await getUserFromAuthHeader(req)
  if (!caller) return { ok: false as const, status: 401, error: 'Unauthorized' }

  const { data: callerProfile, error: callerErr } = await serverSupabase
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerErr || !callerProfile || callerProfile.role !== 'Admin') {
    return { ok: false as const, status: 403, error: 'Forbidden' }
  }

  return { ok: true as const }
}

export async function GET(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '20')

    const from = Math.max(0, (page - 1) * pageSize)
    const to = from + Math.max(1, pageSize) - 1

    const { data, error, count } = await serverSupabase
      .from('tasks')
      .select('id,title,description,reporting_area,created_at,author_id,deleted_at,deleted_by,users(name,email)', { count: 'exact' })
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = data || []
    const authorIds = Array.from(new Set(rows.map((item: any) => item.author_id).filter(Boolean)))

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

    const tasks = rows.map((item: any) => ({
      ...item,
      author_name:
        item.users?.name ||
        item.users?.email ||
        usersById[item.author_id]?.name ||
        usersById[item.author_id]?.email ||
        (item.author_id ? `User ${String(item.author_id).slice(0, 8)}` : 'User')
    }))

    return NextResponse.json({
      tasks,
      count: count || 0,
      page,
      pageSize
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const body = await req.json().catch(() => ({}))
    const taskId = body.taskId?.toString()
    const reason = body.reason?.toString() || ''
    if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

    const { error } = await serverSupabase.rpc('restore_task_with_reason', {
      p_task_id: taskId,
      p_reason: reason
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
