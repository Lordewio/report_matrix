import { NextResponse } from 'next/server'
import serverSupabase from '../../../../src/lib/serverSupabase'
import { getUserFromAuthHeader } from '../../../../src/lib/serverAuth'

export async function GET(req: Request) {
  try {
    const caller = await getUserFromAuthHeader(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: callerProfile, error: callerErr } = await serverSupabase
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerErr || !callerProfile || callerProfile.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '20')
    const action = url.searchParams.get('action') || ''
    const entity = url.searchParams.get('entity') || ''

    const from = Math.max(0, (page - 1) * pageSize)
    const to = from + Math.max(1, pageSize) - 1

    let query = serverSupabase
      .from('audit_logs')
      .select('id,actor_id,action,entity,entity_id,metadata,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (action) query = query.eq('action', action)
    if (entity) query = query.eq('entity', entity)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      logs: data || [],
      count: count || 0,
      page,
      pageSize
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
