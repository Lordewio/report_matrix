import { NextResponse } from 'next/server'
import serverSupabase from '../../../../src/lib/serverSupabase'
import { getUserFromAuthHeader } from '../../../../src/lib/serverAuth'

async function requireAdmin(req: Request) {
  const caller = await getUserFromAuthHeader(req)
  if (!caller) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), caller: null }

  const { data: callerProfile, error: callerErr } = await serverSupabase
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerErr || !callerProfile || callerProfile.role !== 'Admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), caller: null }
  }

  return { error: null, caller }
}

export async function GET(req: Request) {
  try {
    const adminCheck = await requireAdmin(req)
    if (adminCheck.error) return adminCheck.error

    const { data: users, error } = await serverSupabase
      .from('users')
      .select('id,name,email,role,created_at')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: users || [] })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdmin(req)
    if (adminCheck.error || !adminCheck.caller) return adminCheck.error!

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const name = String(body?.name || '').trim()
    const role = body?.role === 'Admin' ? 'Admin' : 'User'

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Email and password (min 6 chars) are required.' }, { status: 400 })
    }

    const { data: created, error: createError } = await serverSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0] }
    })

    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create user.' }, { status: 500 })
    }

    const userId = created.user.id
    const displayName = name || created.user.user_metadata?.name || email.split('@')[0]

    const { error: upsertError } = await serverSupabase
      .from('users')
      .upsert({ id: userId, email, name: displayName, role }, { onConflict: 'id' })

    if (upsertError) {
      await serverSupabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    await serverSupabase.from('audit_logs').insert({
      actor_id: adminCheck.caller.id,
      action: 'USER_CREATED',
      entity: 'users',
      entity_id: userId,
      metadata: { email, role }
    })

    return NextResponse.json({
      user: {
        id: userId,
        email,
        name: displayName,
        role,
        created_at: created.user.created_at || new Date().toISOString()
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const adminCheck = await requireAdmin(req)
    if (adminCheck.error || !adminCheck.caller) return adminCheck.error!

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '').trim()
    if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 })

    if (userId === adminCheck.caller.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }

    const { data: targetUser } = await serverSupabase
      .from('users')
      .select('id, role, email')
      .eq('id', userId)
      .single()

    if (!targetUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    const { count: tasksCount, error: tasksErr } = await serverSupabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)

    if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 })
    if ((tasksCount || 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete user with existing tasks.' }, { status: 400 })
    }

    if (targetUser.role === 'Admin') {
      const { count: adminCount, error: adminCountErr } = await serverSupabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'Admin')

      if (adminCountErr) return NextResponse.json({ error: adminCountErr.message }, { status: 500 })
      if ((adminCount || 0) <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last admin user.' }, { status: 400 })
      }
    }

    const { error: authDeleteError } = await serverSupabase.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return NextResponse.json({ error: authDeleteError.message }, { status: 500 })
    }

    const { error: profileDeleteError } = await serverSupabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      return NextResponse.json({ error: profileDeleteError.message }, { status: 500 })
    }

    await serverSupabase.from('audit_logs').insert({
      actor_id: adminCheck.caller.id,
      action: 'USER_DELETED',
      entity: 'users',
      entity_id: userId,
      metadata: { email: targetUser.email }
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const adminCheck = await requireAdmin(req)
    if (adminCheck.error || !adminCheck.caller) return adminCheck.error!

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '').trim()
    const password = String(body?.password || '')

    if (!userId || password.length < 6) {
      return NextResponse.json({ error: 'userId and password (min 6 chars) are required.' }, { status: 400 })
    }

    const { data: targetUser } = await serverSupabase
      .from('users')
      .select('id,email')
      .eq('id', userId)
      .single()

    if (!targetUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    const { error: updateError } = await serverSupabase.auth.admin.updateUserById(userId, { password })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await serverSupabase.from('audit_logs').insert({
      actor_id: adminCheck.caller.id,
      action: 'USER_PASSWORD_RESET',
      entity: 'users',
      entity_id: userId,
      metadata: { email: targetUser.email }
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
