
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../supabase'

const pwRules = [
  { id:'len',   en:'8+ chars',  ar:'8+ أحرف',  test:p=>p.length>=8 },
  { id:'upper', en:'Uppercase', ar:'حرف كبير', test:p=>/[A-Z]/.test(p) },
  { id:'lower', en:'Lowercase', ar:'حرف صغير', test:p=>/[a-z]/.test(p) },
  { id:'num',   en:'Number',    ar:'رقم',      test:p=>/\d/.test(p) },
  { id:'sym',   en:'Symbol',    ar:'رمز',      test:p=>/[^A-Za-z0-9]/.test(p) },
]
const pwStrength = p => pwRules.filter(r=>r.test(p)).length

const Logo = () => (
  <svg width="38" height="38" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="10" fill="url(#lgl)"/>
    <path d="M18 8L28 13V20C28 25.5 23.5 29 18 30C12.5 29 8 25.5 8 20V13L18 8Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
    <path d="M14 20L17 23L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <defs><linearGradient id="lgl" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#1a4731"/><stop offset="1" stopColor="#0f2d1e"/></linearGradient></defs>
  </svg>
)
const EyeOpen  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeClose = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>

export default function LoginPage() {
  const { login, signup } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab]           = useState('login')
  const [uiLang, setUiLang]     = useState('en')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [university, setUniversity] = useState('')
  const [faculty, setFaculty]   = useState('')
  const [department, setDept]   = useState('')
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent]   = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const isAr    = uiLang === 'ar'
  const isSignup = tab === 'signup'
  const str     = pwStrength(password)
  const allMet  = str === pwRules.length
  const strColors = ['','var(--red)','var(--yellow)','var(--accent)','var(--success)','var(--success)']
  const strLabels = { en:['','Weak','Fair','Good','Strong','Very Strong'], ar:['','ضعيفة','مقبولة','جيدة','قوية','قوية جداً'] }

  const handle = async e => {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true)
    try {
      if (isSignup) {
        if (!name.trim()) { setError(isAr?'أدخل اسمك':'Enter your name.'); setLoading(false); return }
        if (!allMet)      { setError(isAr?'كلمة المرور لا تستوفي المتطلبات':"Password does not meet all requirements."); setLoading(false); return }
        await signup(email, password, name.trim())
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from('profiles').update({
            university: university.trim(), faculty: faculty.trim(),
            department: department.trim(), language: uiLang
          }).eq('id', session.user.id)
        }
        setInfo(isAr?'تم إنشاء الحساب! يمكنك الآن تسجيل الدخول.':'Account created! You can now sign in.')
        setTab('login'); setPassword('')
      } else {
        await login(email, password)
        navigate('/dashboard')
      }
    } catch (err) {
      const map = {
        'Invalid login credentials': isAr?'بريد إلكتروني أو كلمة مرور غير صحيحة':'Incorrect email or password.',
        'User already registered':   isAr?'البريد الإلكتروني مسجل بالفعل':'Email already registered.',
      }
      const found = Object.keys(map).find(k => err.message?.includes(k))
      setError(found ? map[found] : (err.message || (isAr?'حدث خطأ':'Something went wrong.')))
    } finally { setLoading(false) }
  }

  const switchTab = t => { setTab(t); setError(''); setInfo(''); setPassword(''); setShowForgot(false) }

  const sendReset = async e => {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setError(isAr ? 'حدث خطأ — تحقق من البريد الإلكتروني' : 'Error — check the email address')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="login-page" dir={isAr?'rtl':'ltr'}>
      <div style={{position:'fixed',top:14,left:14,right:14,display:'flex',justifyContent:'space-between',zIndex:10}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/')} style={{display:'flex',alignItems:'center',gap:5}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={isAr?"9 18 15 12 9 6":"15 18 9 12 15 6"}/></svg>
          {isAr?'الرئيسية':'Home'}
        </button>
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setUiLang(l=>l==='en'?'ar':'en')}>{isAr?'EN':'عربي'}</button>
          <button className="icon-btn" onClick={toggle} style={{background:'var(--bg-3)',border:'1px solid var(--border)'}}>{theme==='dark'?'☀️':'🌙'}</button>
        </div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:10}}>
            <Logo/>
            <span style={{fontFamily:'Playfair Display,serif',fontSize:22,fontWeight:700,color:'var(--text-1)'}}>AttendIQ</span>
          </div>
          <p>{isAr?'منصة الحضور الذكي للمؤسسات التعليمية':'Smart Attendance for Academic Institutions'}</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab==='login'?'active':''}`}  onClick={()=>switchTab('login')}>{isAr?'تسجيل الدخول':'Sign In'}</button>
          <button className={`auth-tab ${tab==='signup'?'active':''}`} onClick={()=>switchTab('signup')}>{isAr?'إنشاء حساب':'Register'}</button>
        </div>

        <form className="login-form" onSubmit={handle}>
          {error && <div className="form-error">⚠️ {error}</div>}
          {info  && <div className="form-info">✓ {info}</div>}

          {isSignup && (
            <div className="input-group">
              <label className="input-label">{isAr?'الاسم الكامل':'Full Name'}</label>
              <input className="input" placeholder={isAr?'د. محمد أحمد':'Dr. Ahmad Hassan'} value={name} onChange={e=>setName(e.target.value)} required/>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">{isAr?'البريد الإلكتروني':'Email Address'}</label>
            <input className="input" type="email" placeholder="teacher@university.edu" value={email} onChange={e=>setEmail(e.target.value)} required/>
          </div>

          <div className="input-group">
            <label className="input-label">
              <span>{isAr?'كلمة المرور':'Password'}</span>
              {!isSignup && (
                <button type="button" onClick={()=>{ setShowForgot(true); setError(''); setResetSent(false); setResetEmail(email) }}
                  style={{background:'none',border:'none',color:'var(--accent)',fontSize:11,cursor:'pointer',fontFamily:'inherit',marginRight:8}}>
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              )}
            </label>
            <div className="input-with-icon">
              <input className="input" type={showPw?'text':'password'}
                placeholder={isSignup?(isAr?'8+ أحرف، كبيرة وصغيرة، أرقام، رموز':'8+ chars, upper, lower, number, symbol'):'••••••••'}
                value={password} onChange={e=>setPassword(e.target.value)} required/>
              <button type="button" className="input-eye" onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeClose/>:<EyeOpen/>}</button>
            </div>
            {isSignup && password.length > 0 && (
              <div className="pw-strength">
                <div className="pw-strength-bar">
                  {[1,2,3,4,5].map(i=><div key={i} className={`pw-bar-seg ${i<=str?`active-${Math.min(str,4)}`:''}`}/>)}
                </div>
                {str>0 && <div style={{fontSize:11,color:strColors[str],fontWeight:600,marginBottom:5}}>{strLabels[isAr?'ar':'en'][str]}</div>}
                <div className="pw-rules">
                  {pwRules.map(r=><span key={r.id} className={`pw-rule ${r.test(password)?'met':''}`}>{r.test(password)?'✓':'○'} {isAr?r.ar:r.en}</span>)}
                </div>
              </div>
            )}
          </div>

          {isSignup && (
            <>
              <div className="divider-text">{isAr?'معلومات المؤسسة':'Institution Info'}</div>
              <div className="input-group">
                <label className="input-label">{isAr?'الجامعة / المؤسسة':'University / Institution'}</label>
                <input className="input" placeholder={isAr?'جامعة الأردن':'University of Jordan'} value={university} onChange={e=>setUniversity(e.target.value)}/>
              </div>
              <div className="input-row">
                <div className="input-group">
                  <label className="input-label">{isAr?'الكلية':'Faculty'}</label>
                  <input className="input" placeholder={isAr?'كلية الهندسة':'Engineering'} value={faculty} onChange={e=>setFaculty(e.target.value)}/>
                </div>
                <div className="input-group">
                  <label className="input-label">{isAr?'القسم':'Department'}</label>
                  <input className="input" placeholder={isAr?'حاسوب':'CS'} value={department} onChange={e=>setDept(e.target.value)}/>
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn btn-green btn-full btn-lg" style={{marginTop:4}} disabled={loading}>
            {loading?(isAr?'جاري المعالجة…':'Please wait…'):isSignup?(isAr?'إنشاء الحساب':'Create Account'):(isAr?'تسجيل الدخول':'Sign In →')}
          </button>
        </form>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{width:'100%',maxWidth:380,background:'var(--modal-bg)',border:'1px solid var(--border-2)',borderRadius:22,padding:'28px 24px',boxShadow:'var(--shadow-lg)'}}>
            {resetSent ? (
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:12}}>📧</div>
                <div style={{fontSize:18,fontWeight:800,marginBottom:8,color:'var(--success)'}}>
                  {isAr ? 'تم الإرسال!' : 'Email Sent!'}
                </div>
                <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:20}}>
                  {isAr
                    ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${resetEmail} — تحقق من بريدك الإلكتروني وانقر على الرابط.`
                    : `A password reset link was sent to ${resetEmail} — check your email and click the link.`}
                </div>
                <div style={{fontSize:12,color:'var(--text-3)',marginBottom:20}}>
                  {isAr ? '⚠️ تحقق من مجلد Spam إذا لم تجده' : "⚠️ Check your Spam folder if you don't see it"}
                </div>
                <button className="btn btn-primary btn-full" onClick={()=>setShowForgot(false)}>
                  {isAr ? 'حسناً' : 'OK'}
                </button>
              </div>
            ) : (
              <>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <div style={{fontSize:17,fontWeight:700}}>{isAr ? 'استعادة كلمة المرور' : 'Reset Password'}</div>
                  <button onClick={()=>setShowForgot(false)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:18}}>✕</button>
                </div>
                <div style={{fontSize:13,color:'var(--text-2)',marginBottom:16,lineHeight:1.6}}>
                  {isAr
                    ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.'
                    : "Enter your email and we'll send you a link to reset your password."}
                </div>
                {error && <div className="form-error" style={{marginBottom:12}}>⚠️ {error}</div>}
                <form onSubmit={sendReset} style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div className="input-group">
                    <label className="input-label">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <input className="input" type="email" placeholder="teacher@university.edu"
                      value={resetEmail} onChange={e=>setResetEmail(e.target.value)} required autoFocus/>
                  </div>
                  <button type="submit" className="btn btn-green btn-full btn-lg" disabled={resetLoading}>
                    {resetLoading ? (isAr ? 'جاري الإرسال…' : 'Sending…') : (isAr ? '📧 إرسال رابط الاستعادة' : '📧 Send Reset Link')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-full" onClick={()=>setShowForgot(false)}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
