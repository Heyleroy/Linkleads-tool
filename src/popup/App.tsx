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

interface EnrichedProfile {
  name: string | null
  email: string | null
  company: string | null
  industry: string | null
  size: string | null
  url: string
  timestamp: number
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'license'>('dashboard')
  const [licenseKey, setLicenseKey] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [history, setHistory] = useState<EnrichedProfile[]>([])
  const [lookupsRemaining, setLookupsRemaining] = useState(10)

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

        // Check local Pro status
        chrome.storage.local.get(['isPro', 'lookupsUsed'], (items) => {
          setIsPro(items.isPro || false)
          const used = items.lookupsUsed || 0
          setLookupsRemaining(Math.max(0, 10 - used))
        })

        // Load history
        chrome.storage.local.get(['enrichmentHistory'], (items) => {
          setHistory(items.enrichmentHistory || [])
        })
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
      setIsPro(false)
      chrome.storage.local.remove(['isPro', 'lookupsUsed', 'licenseKey'])
    } catch (err) {
      console.error('Logout error:', err)
      setError('Failed to logout')
    }
  }

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key')
      return
    }

    try {
      setActivatingLicense(true)
      setError(null)

      // Simple validation: check license key format (you can add server validation later)
      if (licenseKey.length < 10) {
        setError('Invalid license key format')
        return
      }

      // Store Pro status locally
      chrome.storage.local.set({
        isPro: true,
        licenseKey: licenseKey,
        activatedAt: new Date().toISOString(),
      })

      setIsPro(true)
      setLicenseKey('')
      setActiveTab('dashboard')
    } catch (err) {
      console.error('License activation error:', err)
      setError('Failed to activate license')
    } finally {
      setActivatingLicense(false)
    }
  }

  const exportHistoryAsCSV = (): void => {
    if (history.length === 0) {
      setError('No history to export')
      return
    }

    const headers = ['Name', 'Email', 'Company', 'Industry', 'Company Size', 'URL', 'Date']
    const rows = history.map((profile) => [
      profile.name || '',
      profile.email || '',
      profile.company || '',
      profile.industry || '',
      profile.size || '',
      profile.url || '',
      new Date(profile.timestamp).toLocaleString(),
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `linkleads-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearHistory = (): void => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      chrome.storage.local.set({ enrichmentHistory: [] })
      setHistory([])
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
          <button className="google-btn" onClick={handleGoogleSignIn} disabled={signingIn}>
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
          {/* Tab Navigation */}
          <div className="tab-nav">
            <button
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button className={`tab-button ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              📋 History {history.length > 0 && <span className="badge">{history.length}</span>}
            </button>
            {!isPro && (
              <button
                className={`tab-button ${activeTab === 'license' ? 'active' : ''}`}
                onClick={() => setActiveTab('license')}
              >
                🔓 License
              </button>
            )}
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              <div className="user-info">
                <div className="user-email">{session.user.email}</div>
                <div className="user-name">{session.user.user_metadata?.full_name || 'User'}</div>
              </div>

              <div className="lookups-badge">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="lookups-label">Lookups Remaining</div>
                  {isPro && <span style={{ fontSize: '11px', background: '#4ade80', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>PRO</span>}
                </div>
                <div className="lookups-count">{isPro ? '∞' : lookupsRemaining}</div>
                {!isPro && (
                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
                    Resets daily • <a href="https://buy.linkleads.app" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'underline' }}>Upgrade to Pro</a>
                  </div>
                )}
              </div>

              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255, 255, 255, 0.7)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                  <div>No profiles enriched yet</div>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>Click "Enrich" on a LinkedIn profile to get started</div>
                </div>
              ) : (
                <>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '12px' }}>
                    {history.map((profile, idx) => (
                      <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'white', marginBottom: '4px' }}>{profile.name || 'Unknown'}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)' }}>📧 {profile.email || 'N/A'}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
                          {profile.company || 'N/A'} • {profile.industry || 'N/A'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                          {new Date(profile.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isPro && (
                    <button className="primary-btn" onClick={exportHistoryAsCSV} style={{ marginBottom: '8px' }}>
                      📥 Export as CSV
                    </button>
                  )}
                  <button className="secondary-btn" onClick={clearHistory}>
                    🗑️ Clear History
                  </button>
                </>
              )}
            </>
          )}

          {/* License Tab */}
          {activeTab === 'license' && !isPro && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚀</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>Unlock Pro Features</div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px' }}>
                  Unlimited lookups, CSV export, and priority support
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Enter your license key"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <button
                className="primary-btn"
                onClick={handleActivateLicense}
                disabled={activatingLicense || !licenseKey.trim()}
                style={{ marginBottom: '8px' }}
              >
                {activatingLicense ? (
                  <>
                    <div className="spinner" style={{ width: '12px', height: '12px', marginRight: '8px' }}></div>
                    Activating...
                  </>
                ) : (
                  '✓ Activate License'
                )}
              </button>

              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
                Don't have a key?{' '}
                <a href="https://buy.linkleads.app" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'underline' }}>
                  Get Pro Now
                </a>
              </div>
            </>
          )}
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
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default App
