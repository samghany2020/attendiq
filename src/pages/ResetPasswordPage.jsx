import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const pwRules = [
  { id:'len',   en:'8+ chars',  ar:'8+ أحرف',  test:p=>p.length>=8 },
  { id:'upper', en:'Uppercase', ar:'حرف كبير', test:p=>/[A-Z]/.test(p) },
  { id:'lower', en:'Lowercase', ar:'حرف صغير', test:p=>/[a-z]/.test(p) },
  { id:'num',   en:'Number',    ar:'رقم',      test:p=>/\d/.test(p) },
]
const strength = p => pwRules.filter(r => r.test(p)).length

const EyeOpen  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeClose = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)
  const [validLink, setValidLink] = useState(false)
  const [checking,  setChecking]  = useState(true)

  const str    = strength(password)
  const allMet = str >= 4
  const strColors = ['','var(--red)','var(--yellow)','var(--accent)','var(--success)']

  // Supabase sends the token in the URL hash — verify session exists
  useEffect(() => {
    const check = async () => {
      // When user clicks the reset link, Supabase sets the session from URL hash
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setValidLink(true)
      } else {
        // Try to get session from URL hash (Supabase puts tokens in hash)
        const hash = window.location.hash
        if (hash.includes('access_token') || hash.includes('type=recovery')) {
          setValidLink(true)
        } else {
          setValidLink(false)
        }
      }
      setChecking(false)
    }
    check()

    // Listen for auth state — Supabase will fire PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setValidLink(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async e => {
    e.preventDefault()
    if (!allMet)              { setError('Password does not meet all requirements.'); return }
    if (password !== password2) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return (
    <div className="login-page">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        <div className="spinner"/>
        <div style={{ color:'var(--text-2)', fontSize:13 }}>Verifying reset link…</div>
      </div>
    </div>
  )

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-header">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:10 }}>
            <svg width="38" height="38" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="url(#rpl)"/>
              <path d="M14 20L17 23L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="rpl" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#1a4731"/><stop offset="1" stopColor="#0f2d1e"/></linearGradient></defs>
            </svg>
            <span style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:700, color:'var(--text-1)' }}>AttendIQ</span>
          </div>
        </div>

        {done ? (
          <div style={{ textAlign:'center', padding:'10px 0 20px' }}>
            <div style={{ width:68, height:68, borderRadius:'50%', background:'var(--success-dim)', border:'2px solid rgba(58,158,96,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 16px', animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)' }}>✓</div>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--success)', marginBottom:8 }}>Password Updated!</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:6 }}>Your password has been changed successfully.</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>Redirecting to login in 3 seconds…</div>
          </div>
        ) : !validLink ? (
          <div style={{ textAlign:'center', padding:'10px 0 20px' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>⏱️</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Link Expired</div>
            <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, marginBottom:20 }}>
              This password reset link has expired or is invalid.<br/>
              Please request a new one.
            </div>
            <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign:'center', marginBottom:22 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'var(--text-1)', marginBottom:4 }}>Set New Password</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>Choose a strong password for your account</div>
            </div>

            {error && <div className="form-error" style={{ marginBottom:14 }}>⚠️ {error}</div>}

            <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="input-group">
                <label className="input-label">New Password</label>
                <div className="input-with-icon">
                  <input className="input" type={showPw ? 'text' : 'password'}
                    placeholder="8+ chars, upper, lower, number"
                    value={password} onChange={e => setPassword(e.target.value)} required autoFocus/>
                  <button type="button" className="input-eye" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeClose/> : <EyeOpen/>}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="pw-strength" style={{ marginTop:6 }}>
                    <div className="pw-strength-bar">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`pw-bar-seg ${i <= str ? `active-${Math.min(str,4)}` : ''}`}/>
                      ))}
                    </div>
                    <div className="pw-rules" style={{ marginTop:4 }}>
                      {pwRules.map(r => (
                        <span key={r.id} className={`pw-rule ${r.test(password) ? 'met' : ''}`}>
                          {r.test(password) ? '✓' : '○'} {r.en}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">Confirm New Password</label>
                <input className="input" type={showPw ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={password2} onChange={e => setPassword2(e.target.value)} required/>
                {password2.length > 0 && password !== password2 && (
                  <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>⚠️ Passwords do not match</div>
                )}
                {password2.length > 0 && password === password2 && allMet && (
                  <div style={{ fontSize:11, color:'var(--success)', marginTop:4 }}>✓ Passwords match</div>
                )}
              </div>

              <button type="submit" className="btn btn-green btn-full btn-lg"
                disabled={loading || !allMet || password !== password2}>
                {loading ? 'Updating…' : '🔒 Update Password'}
              </button>

              <button type="button" className="btn btn-ghost btn-full" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
