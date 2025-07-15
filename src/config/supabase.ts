import { createClient } from '@supabase/supabase-js'

// Get environment variables with fallbacks and debug logging
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug logging
console.debug('Supabase Config:', {
  url: SUPABASE_URL ? 'Set' : 'Missing',
  anonKey: SUPABASE_ANON_KEY ? 'Set' : 'Missing'
})

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables!')
}

// Create Supabase client
export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
)

// Debug helper for database operations
export const debugDb = async (operation: string, error: any) => {
  console.debug(`[DB ${operation}]`, error ? 'Error:' : 'Success')
  if (error) {
    console.error(error)
  }
} 