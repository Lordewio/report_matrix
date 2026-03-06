import serverSupabase from './serverSupabase'

export async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (!auth) return null
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    const { data, error } = await serverSupabase.auth.getUser(token)
    if (error) return null
    return data.user
  }
  return null
}
