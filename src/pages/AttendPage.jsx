
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

const fmtDate = (d,isAr) => d ? new Date(d).toLocaleDateString(isAr?'ar-EG':'en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : ''

function isTokenValid(sessionId, token, searchParams) {
  if (!token) return false
  // Fixed QR mode — token never expires
  if (searchParams.get('fixed') === '1' || token === btoa(`${sessionId}:fixed`).replace(/=/g,'')) {
    return token === btoa(`${sessionId}:fixed`).replace(/=/g,'')
  }
  // Rotating — use custom interval from URL param, default 30s
  const iv = parseInt(searchParams.get('iv') || '30', 10)
  const now = Math.floor(Date.now() / (iv * 1000))
  // Accept ±10 windows to handle clock skew (covers up to 5 minutes difference)
  const windows = []
  for (let i = -10; i <= 2; i++) windows.push(now + i)
  return windows.map(w => btoa(`${sessionId}:${w}`).replace(/=/g,'')).includes(token)
}

async function getFingerprint() {
  const raw = [navigator.userAgent,navigator.language,screen.width+'x'+screen.height,Intl.DateTimeFormat().resolvedOptions().timeZone].join('|')
  const buf = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32)
}

const MAX_ATTEMPTS=5, WINDOW_MINS=10
const OFFLINE_KEY = id => `attendiq_offline_${id}`

const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="9" fill="url(#al1)"/>
    <path d="M14 20L17 23L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <defs><linearGradient id="al1" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#1a4731"/><stop offset="1" stopColor="#0f2d1e"/></linearGradient></defs>
  </svg>
)

export default function AttendPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')

  const [session,setSession]         = useState(null)
  const [loadError,setLoadError]     = useState('')
  const [tokenError,setTokenError]   = useState(false)
  const [studentId,setStudentId]     = useState('')
  const [studentName,setStudentName] = useState('')
  const [photoData,setPhotoData]     = useState(null)
  const [photoPreview,setPhotoPreview] = useState(null)
  const [consent,setConsent]         = useState(false)
  const [submitting,setSubmitting]   = useState(false)
  const [result,setResult]           = useState(null)
  const [resolvedName,setResolvedName] = useState('')
  const [blocked,setBlocked]         = useState(false)
  const [isOffline,setIsOffline]     = useState(!navigator.onLine)
  const [syncing,setSyncing]         = useState(false)
  const [uiLang,setUiLang]           = useState('en')
  const isAr = uiLang==='ar'

  useEffect(()=>{
    const goOnline=()=>{ setIsOffline(false); syncQueue() }
    const goOffline=()=>setIsOffline(true)
    window.addEventListener('online',goOnline); window.addEventListener('offline',goOffline)
    return ()=>{ window.removeEventListener('online',goOnline); window.removeEventListener('offline',goOffline) }
  },[])

  useEffect(()=>{
    supabase.from('sessions').select('id,name,name_ar,subject,subject_ar,date,status,students,teacher_name,university,faculty').eq('id',id).single()
      .then(({data,error})=>{
        if(error||!data){ setLoadError('Session not found.'); return }
        setSession(data)
        if(token&&!isTokenValid(id,token,new URLSearchParams(window.location.search))) setTokenError(true)
        if(!token) setTokenError(true)
      })
  },[id,token])

  useEffect(()=>{
    const check=async()=>{
      try{
        const fp=await getFingerprint()
        const cutoff=new Date(Date.now()-WINDOW_MINS*60000).toISOString()
        const {count}=await supabase.from('checkin_attempts').select('*',{count:'exact',head:true}).eq('session_id',id).eq('fingerprint',fp).gte('attempted_at',cutoff)
        if(count>=MAX_ATTEMPTS) setBlocked(true)
      }catch{}
    }
    if(id) check()
  },[id])

  const handleIdChange = val => {
    setStudentId(val)
    const found=(session?.students||[]).find(s=>s.id?.toUpperCase()===val.trim().toUpperCase())
    if(found?.name) setStudentName(found.name)
  }

  const handlePhoto = file => {
    if(!file) return
    if(file.size>2*1024*1024){ alert(isAr?'الصورة يجب أن تكون أقل من 2MB':'Photo must be under 2MB.'); return }
    const reader=new FileReader()
    reader.onload=e=>{ setPhotoData(e.target.result); setPhotoPreview(e.target.result) }
    reader.readAsDataURL(file)
  }

  const syncQueue = async () => {
    const queue=JSON.parse(localStorage.getItem(OFFLINE_KEY(id))||'[]')
    if(!queue.length) return
    setSyncing(true)
    const failed=[]
    for(const record of queue){
      try{ const {error}=await supabase.from('attendance').insert({...record,offline_submitted:true}); if(error&&error.code!=='23505') failed.push(record) }
      catch{ failed.push(record) }
    }
    localStorage.setItem(OFFLINE_KEY(id),JSON.stringify(failed))
    setSyncing(false)
  }

  const saveOffline = record => {
    const queue=JSON.parse(localStorage.getItem(OFFLINE_KEY(id))||'[]')
    if(queue.some(r=>r.student_id===record.student_id)) return false
    queue.push(record); localStorage.setItem(OFFLINE_KEY(id),JSON.stringify(queue)); return true
  }

  const submit = async e => {
    e.preventDefault()
    const sid=studentId.trim().toUpperCase()
    if(!sid||!consent||blocked) return
    if(session?.status!=='active'){ setResult('ended'); return }
    if(!isTokenValid(id,token,new URLSearchParams(window.location.search))){ setTokenError(true); return }
    setSubmitting(true)
    try{
      const found=(session?.students||[]).find(s=>s.id?.toUpperCase()===sid)
      const name=studentName.trim()||found?.name||''
      setResolvedName(name||sid)
      // Detect group from course roster
      const found2=(session?.students||[]).find(s=>s.id?.toUpperCase()===sid)
      const groupName = found2?.group_name || null

      // Get client IP (best-effort, may show proxy IP)
      let ipAddress = null
      let isExternal = false
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json').catch(()=>null)
        if (ipRes) { const ipData = await ipRes.json(); ipAddress = ipData.ip || null }
      } catch(_) {}

      const record={session_id:id,student_id:sid,name,photo_data:photoData||null,
        checked_in_at:new Date().toISOString(),group_name:groupName,
        ip_address:ipAddress,is_external_ip:isExternal}

      if(!navigator.onLine){
        setResult(saveOffline(record)?'success_offline':'already'); setSubmitting(false); return
      }

      const fp=await getFingerprint()
      const cutoff=new Date(Date.now()-WINDOW_MINS*60000).toISOString()
      const {count}=await supabase.from('checkin_attempts').select('*',{count:'exact',head:true}).eq('session_id',id).eq('fingerprint',fp).gte('attempted_at',cutoff)
      if(count>=MAX_ATTEMPTS){ setBlocked(true); setSubmitting(false); return }
      await supabase.from('checkin_attempts').insert({session_id:id,fingerprint:fp})

      const {error}=await supabase.from('attendance').insert(record)
      if(error){ if(error.code==='23505'){setResult('already'); return} throw error }
      setResult('success')
    }catch(err){
      if(!navigator.onLine||err.message?.includes('fetch')){
        saveOffline({session_id:id,student_id:studentId.trim().toUpperCase(),name:studentName.trim(),photo_data:photoData||null,checked_in_at:new Date().toISOString()})
        setResult('success_offline')
      } else { console.error(err); setResult('error') }
    }finally{ setSubmitting(false) }
  }

  if(loadError) return (
    <div className="attend-page"><div className="attend-card" style={{textAlign:'center'}}>
      <div className="error-icon">❌</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Session Not Found</div>
      <div style={{fontSize:13,color:'var(--text-3)'}}>{loadError}</div>
    </div></div>
  )
  if(!session) return <div className="attend-page"><div className="attend-card" style={{textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div></div>
  if(tokenError) return (
    <div className="attend-page"><div className="attend-card" style={{textAlign:'center',direction:isAr?'rtl':'ltr'}}>
      <div className="error-icon">⏱️</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>{isAr?'انتهت صلاحية رمز QR':'QR Code Expired'}</div>
      <div style={{fontSize:13,color:'var(--text-3)',lineHeight:1.6}}>{isAr?'يرجى مسح رمز QR الحالي الظاهر عند المعلم.':'Please scan the current QR code shown by your teacher.'}</div>
    </div></div>
  )
  if(blocked) return (
    <div className="attend-page"><div className="attend-card" style={{textAlign:'center',direction:isAr?'rtl':'ltr'}}>
      <div className="error-icon">🚫</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>{isAr?'محاولات كثيرة جداً':'Too Many Attempts'}</div>
      <div style={{fontSize:13,color:'var(--text-3)'}}>{isAr?`انتظر ${WINDOW_MINS} دقائق وحاول مجدداً.`:`Wait ${WINDOW_MINS} minutes and try again.`}</div>
    </div></div>
  )

  return (
    <div className="attend-page" dir={isAr?'rtl':'ltr'}>
      <div className="attend-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <Logo/>
            <span style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:700}}>AttendIQ</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setUiLang(l=>l==='en'?'ar':'en')} style={{fontSize:11,padding:'4px 10px'}}>{isAr?'EN':'عربي'}</button>
        </div>

        {isOffline && (
          <div style={{background:'var(--yellow-dim)',border:'1px solid rgba(212,160,23,.3)',borderRadius:10,padding:'10px 13px',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:18}}>📶</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--yellow)'}}>{isAr?'لا يوجد اتصال':'No Internet Connection'}</div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>{isAr?'سيتم حفظ الحضور وإرساله تلقائياً عند عودة الاتصال.':'Check-in will be saved and submitted when connection returns.'}</div>
            </div>
          </div>
        )}
        {syncing && (
          <div style={{background:'var(--green-dim)',border:'1px solid var(--green-border)',borderRadius:10,padding:'10px 13px',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <div className="spinner" style={{width:18,height:18,borderWidth:2}}/>
            <span style={{fontSize:13,color:'var(--success)'}}>{isAr?'جاري المزامنة…':'Syncing offline check-ins…'}</span>
          </div>
        )}

        <div className="attend-session-box">
          <div style={{fontSize:20,marginBottom:6}}>🎓</div>
          <div className="attend-session-name">{isAr&&session.name_ar?session.name_ar:session.name}</div>
          <div className="attend-session-meta">
            {(isAr?session.subject_ar||session.subject:session.subject) && <span>{isAr?session.subject_ar||session.subject:session.subject} · </span>}
            {fmtDate(session.date,isAr)}
          </div>
          {session.teacher_name && <div className="attend-session-meta" style={{marginTop:3}}>👤 {session.teacher_name}</div>}
          {session.university && <div className="attend-session-meta" style={{marginTop:2}}>🏛 {session.university}{session.faculty?` · ${session.faculty}`:''}</div>}
        </div>

        {result==='success' ? (
          <div style={{textAlign:'center'}}>
            <div className="success-icon">✓</div>
            <div className="attend-title">{isAr?'تم تسجيل حضورك!':'Checked In!'}</div>
            {resolvedName && <div style={{fontSize:15,color:'var(--accent)',fontWeight:600,marginBottom:8}}>{resolvedName}</div>}
            <div style={{fontSize:12,color:'var(--text-3)'}}>ID: <span className="monospace">{studentId.trim().toUpperCase()}</span></div>
            {photoPreview && <img src={photoPreview} alt="you" style={{width:60,height:60,borderRadius:'50%',objectFit:'cover',margin:'10px auto 0',display:'block',border:'2px solid var(--success)'}}/>}
            <div style={{marginTop:14,padding:'10px 13px',background:'var(--success-dim)',border:'1px solid rgba(58,158,96,.2)',borderRadius:8,fontSize:12,color:'var(--success)'}}>
              ✓ {isAr?'تم التسجيل في':'Recorded at'} {new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
            </div>
          </div>
        ) : result==='success_offline' ? (
          <div style={{textAlign:'center'}}>
            <div style={{width:68,height:68,borderRadius:'50%',background:'var(--yellow-dim)',border:'2px solid rgba(212,160,23,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 16px'}}>📶</div>
            <div className="attend-title">{isAr?'تم الحفظ!':'Saved Offline!'}</div>
            {resolvedName && <div style={{fontSize:15,color:'var(--accent)',fontWeight:600,marginBottom:8}}>{resolvedName}</div>}
            <div style={{padding:'12px 13px',background:'var(--yellow-dim)',border:'1px solid rgba(212,160,23,.2)',borderRadius:8,fontSize:12,color:'var(--yellow)',lineHeight:1.6,marginTop:12}}>
              📶 {isAr?'لا يوجد اتصال. تم حفظ حضورك وستتم المزامنة تلقائياً عند عودة الاتصال.':'No internet. Your attendance is saved and will sync automatically when connection returns.'}
            </div>
          </div>
        ) : result==='already' ? (
          <div style={{textAlign:'center'}}><div style={{fontSize:44,marginBottom:10}}>👋</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>{isAr?'تم التسجيل مسبقاً':'Already Checked In'}</div>
            <div style={{fontSize:13,color:'var(--text-3)'}}>{isAr?'تم تسجيل حضورك بالفعل.':'Your attendance is already recorded.'}</div>
          </div>
        ) : result==='ended' ? (
          <div style={{textAlign:'center'}}><div className="error-icon">🔒</div>
            <div style={{fontSize:16,fontWeight:700}}>{isAr?'انتهت الجلسة':'Session Ended'}</div>
          </div>
        ) : result==='error' ? (
          <div style={{textAlign:'center'}}><div className="error-icon">⚠️</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>{isAr?'حدث خطأ':'Something went wrong'}</div>
            <button className="btn btn-secondary btn-full" onClick={()=>setResult(null)}>{isAr?'حاول مرة أخرى':'Try Again'}</button>
          </div>
        ) : session.status!=='active' ? (
          <div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:10}}>🔒</div>
            <div style={{fontSize:16,fontWeight:700}}>{isAr?'انتهت الجلسة':'Session Has Ended'}</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="attend-title">{isAr?'سجّل حضورك':'Mark Your Attendance'}</div>
            <div className="attend-subtitle">{isAr?'أدخل رقمك الجامعي للتسجيل':'Enter your Student ID to check in'}</div>
            <div className="input-group" style={{marginBottom:11}}>
              <label className="input-label">{isAr?'الرقم الجامعي':'Student ID'} *</label>
              <input className="input" style={{fontSize:20,textAlign:'center',letterSpacing:2,fontFamily:'monospace',textTransform:'uppercase'}} placeholder="e.g. 2023001" value={studentId} onChange={e=>handleIdChange(e.target.value)} autoFocus required/>
            </div>
            <div className="input-group" style={{marginBottom:11}}>
              <label className="input-label">{isAr?'الاسم الكامل':'Full Name'} <span style={{color:'var(--text-3)'}}>{isAr?'(يملأ تلقائياً)':'(auto-fills if in roster)'}</span></label>
              <input className="input" placeholder={isAr?'الاسم الكامل':'Your full name'} value={studentName} onChange={e=>setStudentName(e.target.value)}/>
            </div>
            <div style={{marginBottom:14}}>
              <div className="input-label" style={{marginBottom:5}}>{isAr?'صورة':'Photo'} <span style={{color:'var(--text-3)'}}>{isAr?'(اختياري)':'(optional)'}</span></div>
              {photoPreview ? (
                <div style={{textAlign:'center'}}>
                  <img src={photoPreview} alt="preview" className="photo-preview"/>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setPhotoData(null);setPhotoPreview(null)}}>{isAr?'حذف':'Remove'}</button>
                </div>
              ) : (
                <label className="photo-capture-btn" style={{opacity:!consent?.45:1,pointerEvents:!consent?'none':'auto'}}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>handlePhoto(e.target.files[0])} disabled={!consent} style={{position:'absolute',inset:0,opacity:0,width:'100%',height:'100%'}}/>
                  <span style={{fontSize:22}}>📷</span>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--text-2)'}}>{isAr?'التقاط صورة':'Take a Photo'}</span>
                  <span style={{fontSize:11,color:'var(--text-3)'}}>{!consent?(isAr?'وافق على الشروط أولاً':'Accept consent first'):(isAr?'الحد الأقصى 2MB':'Max 2MB')}</span>
                </label>
              )}
            </div>
            <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer',marginBottom:18,padding:'12px 13px',background:'var(--bg-3)',borderRadius:10,border:consent?'1px solid var(--green-border)':'1px solid var(--border)',transition:'border-color .15s'}}>
              <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{marginTop:2,accentColor:'var(--success)',width:16,height:16,flexShrink:0}}/>
              <span style={{fontSize:12,color:'var(--text-2)',lineHeight:1.6}}>
                {isAr
                  ?'أوافق على جمع رقمي الجامعي واسمي وصورتي الاختيارية وتخزينها بشكل آمن لأغراض الحضور، ولا يمكن الوصول إليها إلا من قبل أستاذي، وفقاً للوائح حماية البيانات.'
                  :'I consent to my Student ID, name, and optional photo being collected and stored securely for attendance purposes, accessible only by my teacher, in accordance with applicable data protection regulations (GDPR / university policy).'}
              </span>
            </label>
            <button type="submit" className="btn btn-green btn-full btn-lg" disabled={submitting||!studentId.trim()||!consent}>
              {submitting?(isAr?'جاري الإرسال…':'Submitting…'):isOffline?(isAr?'💾 حفظ':'💾 Save Offline'):(isAr?'✓ تسجيل الحضور':'✓ Mark Attendance')}
            </button>
            {!consent && <div style={{textAlign:'center',fontSize:11,color:'var(--text-3)',marginTop:8}}>{isAr?'يرجى قبول الموافقة للمتابعة':'Please accept consent to continue'}</div>}
          </form>
        )}

        <div style={{marginTop:20,paddingTop:14,borderTop:'1px solid var(--border)',textAlign:'center',fontSize:11,color:'var(--text-3)',lineHeight:1.6}}>
          🔒 {isAr?'بياناتك مشفرة ولا يمكن الوصول إليها إلا من قبل أستاذك.':'Your data is encrypted and only accessible by your teacher.'}
        </div>
      </div>
    </div>
  )
}
