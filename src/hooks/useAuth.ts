import { create } from 'zustand'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
)

interface User {
  id: string
  email: string
  role: 'member' | 'manager' | 'founder'
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Fetch user profile with role
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single()

      set({
        user: {
          id: data.user?.id || '',
          email: data.user?.email || '',
          role: profile?.role || 'member',
        },
        loading: false,
      })
    } catch (error) {
      set({
        error: (error as Error).message,
        loading: false,
      })
    }
  },

  signOut: async () => {
    try {
      set({ loading: true, error: null })
      await supabase.auth.signOut()
      set({ user: null, loading: false })
    } catch (error) {
      set({
        error: (error as Error).message,
        loading: false,
      })
    }
  },
})) 