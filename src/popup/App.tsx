import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

interface UserProfile {
  user_id: string
  email: string
  lookups_used: number
  plan: string
  lookup_reset_date: string
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  // Initialize auth session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setSession(data.session)

        if (data.session) {
          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', data.session.user.id)
            .single()

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError)
          } else if (profile) {
            setUserProfile(profile)
          }
        }
      } catch (err) {
        console.error('Session check error:', err)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)

      if (newSession && event === 'SIGNED_IN') {
        // Fetch or create user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', newSession.user.id)
          .single()

        if (!profile) {
          // Create new profile for first-time user
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([
              {
                user_id: newSession.user.id,
                email: newSession.user.email,
                lookups_used: 0,
                plan: 'free',
                lookup_reset_date: new Date().toISOString(),
              },
            ])
            .select()
            .single()

          if (createError) {
            console.error('Error creating profile:', createError)
          } else {
            setUserProfile(newProfile)
          }
        } else {
          setUserProfile(profile)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: chrome.runtime.getURL('src/popup/index.html'),
        },
      })

      if (error) {
        setError(error.message || 'Failed to sign in')
      }
    } catch (err) {
      console.error('Sign in error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      setError(null)
      await supabase.auth.signOut()
      setSession(null)
      setUserProfile(null)
    } catch (err) {
      console.error('Logout error:', err)
      setError('Failed to logout')
    }
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="logo">🔗 LinkLeads</div>
      <div className="tagline">LinkedIn Profile Enrichment</div>

      {error && <div className="error">{error}</div>}

      {!session ? (
        <div className="auth-container">
          <button
            className="google-btn"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
          >
            {signingIn ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              <>
                <GoogleIcon />
                Sign in with Google
              </>
            )}
          </button>
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
            No password needed. Just sign in with your Google account.
          </p>
        </div>
      ) : (
        <div className="user-section">
          <div className="user-info">
            <div className="user-email">{session.user.email}</div>
            <div className="user-name">{session.user.user_metadata?.full_name || 'User'}</div>
          </div>

          <div className="lookups-badge">
            <div className="lookups-label">Free Lookups Remaining</div>
            <div className="lookups-count">10</div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
              Resets in {userProfile?.lookup_reset_date ? 'soon' : 'N/A'}
            </div>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg
      className="google-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default App
