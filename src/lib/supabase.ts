import { createClient } from '@supabase/supabase-js'

// Public browser configuration. On Vercel / other hosts these come from env
// vars; the fallbacks are the project's publishable (public) configuration.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://psrmojhyevtkimvqwrmm.supabase.co'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_ti3Ju3yv7n2vJMeSU6-Fmg_jQ2PIPHq'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
