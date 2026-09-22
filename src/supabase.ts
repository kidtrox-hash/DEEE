import { createClient } from '@supabase/supabase-js'

// anon key is public — safe to fallback so cross-device works even without Vercel env set
const FALLBACK_URL = 'https://gqbokhwqawezkpodokik.supabase.co'
const FALLBACK_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxYm9raHdxYXdlemtwb2Rva2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjE2NzcsImV4cCI6MjEwNTYzNzY3N30.Rvn_Ajd5x1et5vfE3t2fep3M5lZo8zyMd5n03oKmV8k'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON

export const supabase = createClient(url, anon, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: { persistSession: true, autoRefreshToken: true }
})

export const isSupabase = true
