import { NextResponse } from 'next/server'
import serverSupabase from '../../../../src/lib/serverSupabase'
import { getUserFromAuthHeader } from '../../../../src/lib/serverAuth'

export async function POST(req: Request) {
  try {
    const caller = await getUserFromAuthHeader(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // verify caller is admin
    const { data: callerProfile, error: callerErr } = await serverSupabase.from('users').select('role').eq('id', caller.id).single()
    if (callerErr || !callerProfile || callerProfile.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form = await req.formData()
    const userId = form.get('userId')?.toString()
    const role = form.get('role')?.toString()
    if (!userId || !role) return NextResponse.json({ error: 'Missing' }, { status: 400 })

    const { error } = await serverSupabase.from('users').update({ role }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
