import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side Supabase client using service role for privileged operations (uploads, etc.)
export const serverSupabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
})

export default serverSupabase
