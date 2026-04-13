import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()
      if (!error && data) setProfile(data)
    } catch (err) {
      console.warn('Profile fetch failed:', err.message)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const newUser = session?.user ?? null
      setUser(prev => {
        if (prev?.id === newUser?.id) return prev
        return newUser
      })
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signup = (email, password, name) =>
    supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
      .then(({ error }) => { if (error) throw error })

  const login = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })
      .then(({ error }) => { if (error) throw error })

  const logout = () => supabase.auth.signOut()

  const updateProfile = async (updates) => {
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (!error) setProfile(p => ({ ...p, ...updates }))
      return !error
    } catch { return false }
  }

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Teacher'
  const lang        = profile?.language || 'en'
  const isAdmin     = profile?.is_admin === true

  return (
    <Ctx.Provider value={{ user, profile, loading, login, signup, logout, updateProfile, displayName, lang, isAdmin }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
