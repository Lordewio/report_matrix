import { NextResponse } from 'next/server'
import serverSupabase from '../../../../src/lib/serverSupabase'
import { getUserFromAuthHeader } from '../../../../src/lib/serverAuth'

export async function GET(req: Request) {
  try {
    const caller = await getUserFromAuthHeader(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const authUsersRes = await serverSupabase.auth.admin.listUsers()
    const authUsers = authUsersRes.data?.users || []
    const activeIds = authUsers.map((user) => user.id)

    if (activeIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    const { data: users, error } = await serverSupabase
      .from('users')
      .select('id,name,email')
      .in('id', activeIds)
      .not('email', 'is', null)
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ users: users || [] })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
