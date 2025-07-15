import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

interface User {
  id: string;
  email: string;
  role: 'member' | 'manager' | 'founder';
  full_name: string | null;
  team_id: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initializeAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultRole = 'member' as const

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initializeAuth: async () => {
    try {
      // Check if Supabase is configured
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'placeholder.supabase.co') {
        console.log('🔄 Supabase not configured, using demo mode')
        // Set a demo user for testing
        set({
          user: {
            id: 'demo-user',
            email: 'demo@levelai.com',
            role: 'member',
            full_name: 'Demo User',
            team_id: null
          },
          loading: false
        })
        return
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      if (session?.user) {
        // First, try to get the existing profile with role
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            team_id,
            role_id
          `)
          .eq('id', session.user.id)
          .single()

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it with default role
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([
              {
                id: session.user.id,
                email: session.user.email,
                full_name: null,
                team_id: null,
                role_id: 1 // Default member role
              }
            ])
            .select()
            .single()

          if (createError) throw createError
          profile = newProfile
        } else if (profileError) {
          console.error('Profile fetch error:', profileError)
          throw profileError
        }

        if (!profile) {
          throw new Error('Failed to get or create profile')
        }

        // Map role_id to role string
        let role: User['role'] = defaultRole
        switch (profile.role_id) {
          case 1:
            role = 'member'
            break
          case 2:
            role = 'manager'
            break
          case 3:
            role = 'founder'
            break
          default:
            console.warn('Unknown role_id:', profile.role_id)
        }

        set({
          user: {
            id: session.user.id,
            email: session.user.email!,
            role: role,
            full_name: profile.full_name,
            team_id: profile.team_id
          },
          loading: false
        })
      } else {
        set({ user: null, loading: false })
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ user: null, loading: false })
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

      if (session?.user) {
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            team_id,
            role_id
          `)
          .eq('id', session.user.id)
          .single()

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it with default role
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([
              {
                id: session.user.id,
                email: session.user.email,
                full_name: null,
                team_id: null,
                role_id: 1 // Default member role
              }
            ])
            .select()
            .single()

          if (createError) throw createError
          profile = newProfile
        } else if (profileError) {
          console.error('Profile fetch error:', profileError)
          throw profileError
        }

        if (!profile) {
          throw new Error('Failed to get or create profile')
        }

        // Map role_id to role string
        let role: User['role'] = defaultRole
        switch (profile.role_id) {
          case 1:
            role = 'member'
            break
          case 2:
            role = 'manager'
            break
          case 3:
            role = 'founder'
            break
          default:
            console.warn('Unknown role_id:', profile.role_id)
        }

        set({
          user: {
            id: session.user.id,
            email: session.user.email!,
            role: role,
            full_name: profile.full_name,
            team_id: profile.team_id
          }
        })
      }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      set({ user: null })
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }
}))

export type { User } 