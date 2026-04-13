import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useEffect } from 'react'

const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="10" fill="url(#lg1)"/>
    <path d="M18 8L28 13V20C28 25.5 23.5 29 18 30C12.5 29 8 25.5 8 20V13L18 8Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
    <path d="M14 20L17 23L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <defs><linearGradient id="lg1" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#1a4731"/><stop offset="1" stopColor="#0f2d1e"/></linearGradient></defs>
  </svg>
)

const Feature = ({ icon, title, titleAr, desc }) => (
  <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 16px',transition:'border-color .2s,transform .2s'}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-border)';e.currentTarget.style.transform='translateY(-2px)'}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none'}}>
    <div style={{fontSize:26,marginBottom:8}}>{icon}</div>
    <div style={{fontSize:14,fontWeight:700,color:'var(--text-1)',marginBottom:2}}>{title}</div>
    {titleAr && <div style={{fontSize:12,color:'var(--accent)',marginBottom:5,direction:'rtl'}}>{titleAr}</div>}
    <div style={{fontSize:12,color:'var(--text-3)',lineHeight:1.6}}>{desc}</div>
  </div>
)

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  useEffect(()=>{ if(user) navigate('/dashboard') },[user])

  return (
    <div style={{minHeight:'100dvh',background:'var(--bg-0)',overflowX:'hidden'}}>
      {/* Header */}
      <header style={{position:'sticky',top:0,zIndex:100,background:'var(--navbar-bg)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:1100,margin:'0 auto',width:'100%'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Logo/>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:700,color:'var(--text-1)'}}>AttendIQ</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="icon-btn" onClick={toggle}>{theme==='dark'?'☀️':'🌙'}</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/login')}>Sign In</button>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate('/login')}>Get Started →</button>
        </div>
      </header>

      <div style={{maxWidth:700,margin:'0 auto',padding:'0 20px'}}>
        {/* Hero */}
        <section style={{textAlign:'center',padding:'56px 0 40px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:40,padding:'5px 14px',marginBottom:24}}>
            <span style={{fontSize:14}}>🎓</span>
            <span style={{fontSize:12,fontWeight:600,color:'var(--accent)'}}>For Universities Worldwide · للجامعات حول العالم</span>
          </div>
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:'clamp(30px,7vw,50px)',fontWeight:800,lineHeight:1.15,color:'var(--text-1)',marginBottom:14}}>
            Smart Attendance<br/>
            <span style={{background:'linear-gradient(90deg,var(--green-2),var(--accent))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Powered by QR Code</span>
          </h1>
          <p style={{fontSize:14,color:'var(--text-2)',maxWidth:460,margin:'0 auto 10px',lineHeight:1.7}}>
            Replace paper sign-in sheets. Works on any phone, no app needed.
            Built for academic institutions worldwide.
          </p>
          <p style={{fontSize:13,color:'var(--text-3)',marginBottom:32,direction:'rtl'}}>
            نظام حضور ذكي للجامعات — يعمل على جميع الهواتف بدون تطبيق
          </p>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',marginBottom:40}}>
            <button className="btn btn-primary btn-lg" onClick={()=>navigate('/login')}>🚀 Start Free — No Credit Card</button>
            <button className="btn btn-secondary btn-lg" onClick={()=>navigate('/login')}>View Demo</button>
          </div>
          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:16,padding:'18px'}}>
            {[['100%','Free forever'],['30s','QR rotation'],['∞','No student limit']].map(([n,l])=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontSize:28,fontWeight:800,fontFamily:'Playfair Display,serif',color:'var(--accent)'}}>{n}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{padding:'0 0 36px'}}>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:24,fontWeight:700,textAlign:'center',marginBottom:6,color:'var(--text-1)'}}>How It Works</h2>
          <p style={{textAlign:'center',fontSize:13,color:'var(--text-3)',marginBottom:22}}>3 steps · كيف يعمل</p>
          {[
            {n:'1',icon:'🏫',t:'Create Session',a:'أنشئ جلسة',d:'Add your university details and create a session. Set a schedule for auto open/close.'},
            {n:'2',icon:'📱',t:'Share QR Code',a:'شارك رمز QR',d:'Show the rotating QR on your screen. Students scan with any phone — no app needed.'},
            {n:'3',icon:'📊',t:'Download Report',a:'حمّل التقرير',d:'Get a full PDF or Excel report instantly after the session ends.'},
          ].map(({n,icon,t,a,d})=>(
            <div key={n} style={{display:'flex',gap:14,alignItems:'flex-start',background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,padding:'16px',marginBottom:8}}>
              <div style={{width:34,height:34,borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,var(--green),var(--green-2))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff'}}>{n}</div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontSize:16}}>{icon}</span>
                  <span style={{fontSize:14,fontWeight:700}}>{t}</span>
                  <span style={{fontSize:12,color:'var(--text-3)',direction:'rtl'}}>· {a}</span>
                </div>
                <div style={{fontSize:12,color:'var(--text-3)',lineHeight:1.6}}>{d}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section style={{padding:'0 0 36px'}}>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:24,fontWeight:700,textAlign:'center',marginBottom:6,color:'var(--text-1)'}}>Everything You Need</h2>
          <p style={{textAlign:'center',fontSize:13,color:'var(--text-3)',marginBottom:20}}>كل ما تحتاجه</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
            <Feature icon="🔄" title="Rotating QR" titleAr="رمز QR متجدد" desc="Changes every 30s — stops screenshot sharing cheating."/>
            <Feature icon="📶" title="Offline Mode" titleAr="وضع بلا إنترنت" desc="WiFi drops? Check-ins save locally and sync automatically."/>
            <Feature icon="⏰" title="Auto Schedule" titleAr="جدولة تلقائية" desc="Set start/end times — sessions open and close automatically."/>
            <Feature icon="🌍" title="Arabic + English" titleAr="عربي + إنجليزي" desc="Full bilingual support — switch any time in settings."/>
            <Feature icon="📋" title="Roster Upload" titleAr="رفع قائمة الطلاب" desc="Upload Excel or CSV with student IDs for instant matching."/>
            <Feature icon="🔒" title="GDPR Compliant" titleAr="متوافق مع GDPR" desc="Encrypted, private, deletable. Consent checkbox on check-in."/>
          </div>
        </section>

        {/* CTA */}
        <section style={{padding:'0 0 40px'}}>
          <div style={{background:'linear-gradient(135deg,var(--green-dim),var(--accent-dim))',border:'1px solid var(--green-border)',borderRadius:20,padding:'28px 22px',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:10}}>🎓</div>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:20,fontWeight:700,marginBottom:6}}>Made for Every Institution</h2>
            <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:6}}>Universities · Colleges · Schools · Training Centers</p>
            <p style={{fontSize:12,color:'var(--text-3)',direction:'rtl',marginBottom:22}}>جامعات · كليات · مدارس · مراكز تدريب</p>
            <button className="btn btn-primary btn-lg btn-full" onClick={()=>navigate('/login')}>Create Your Free Account →</button>
            <div style={{marginTop:8,fontSize:11,color:'var(--text-3)'}}>Free forever · No credit card · Works on any phone</div>
          </div>
        </section>
      </div>

      <footer style={{borderTop:'1px solid var(--border)',padding:'20px',textAlign:'center',fontSize:12,color:'var(--text-3)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:6}}>
          <Logo/><span style={{fontFamily:'Playfair Display,serif',fontWeight:700,color:'var(--text-2)'}}>AttendIQ</span>
        </div>
        Smart Attendance Platform · Free for all institutions<br/>
        <span style={{direction:'rtl',display:'block',marginTop:3}}>منصة الحضور الذكي · مجاني لجميع المؤسسات</span>
      </footer>
    </div>
  )
}