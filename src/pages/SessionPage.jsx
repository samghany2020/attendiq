
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../i18n'

const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''
const initials = name => name ? name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?'

function getInterval(session) {
  if (!session) return 30
  if (session.qr_mode === 'fixed') return 0
  return session.qr_interval || 30
}

function useRotatingToken(sessionId, interval) {
  const ival = interval || 30
  const getToken = () => {
    if (ival === 0) return btoa(`${sessionId}:fixed`).replace(/=/g,'')
    const w = Math.floor(Date.now() / (ival * 1000))
    return btoa(`${sessionId}:${w}`).replace(/=/g,'')
  }
  const [token, setToken]           = useState(getToken)
  const [secondsLeft, setSecondsLeft] = useState(() => ival > 0 ? ival - (Math.floor(Date.now()/1000) % ival) : 0)
  useEffect(()=>{
    if (ival === 0) { setToken(getToken()); return }
    const iv = setInterval(()=>{
      const s = ival - (Math.floor(Date.now()/1000) % ival)
      setSecondsLeft(s); if (s === ival) setToken(getToken())
    }, 1000)
    return ()=>clearInterval(iv)
  }, [sessionId, ival])
  return { token, secondsLeft }
}

export default function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useAuth()
  const tr  = useT(lang)
  const isAr = lang==='ar'

  const [session,setSession]           = useState(null)
  const [attendance,setAttendance]     = useState([])
  const [tab,setTab]                   = useState('qr')
  const [qrConfig,setQrConfig]         = useState({fgColor:'#1a3a2a',bgColor:'#ffffff',size:256,level:'H'})
  const [showQRCust,setShowQRCust]     = useState(false)
  const [copied,setCopied]             = useState(false)
  const [showEndModal,setShowEndModal] = useState(false)
  const [ending,setEnding]             = useState(false)
  const [uploading,setUploading]       = useState(false)
  const [manualId,setManualId]         = useState('')
  const [manualName,setManualName]     = useState('')
  const [addingStudent,setAddingStudent] = useState(false)

  const qrInterval = session?.qr_mode === 'fixed' ? 0 : (session?.qr_interval || 30)
  const { token, secondsLeft } = useRotatingToken(id, qrInterval)
  const attendUrl = session?.qr_mode === 'fixed' ? `${window.location.origin}/attend/${id}?t=${token}&fixed=1` : `${window.location.origin}/attend/${id}?t=${token}&iv=${qrInterval}`
  const isFixed = session?.qr_mode === 'fixed'
  const timerColor = isFixed ? 'var(--success)' : secondsLeft<=10 ? 'var(--red)' : secondsLeft<=20 ? 'var(--yellow)' : 'var(--success)'

  const fetchSession = async () => {
    const { data,error } = await supabase.from('sessions').select('*').eq('id',id).single()
    if (error||!data) { navigate('/dashboard'); return }
    setSession(data); if(data.qr_config) setQrConfig(data.qr_config)
  }
  const fetchAttendance = async () => {
    const {data} = await supabase.from('attendance').select('*').eq('session_id',id).order('checked_in_at',{ascending:false})
    setAttendance(data||[])
  }

  useEffect(()=>{ fetchSession(); fetchAttendance() },[id])

  useEffect(()=>{
    const ch = supabase.channel(`att-${id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'attendance',filter:`session_id=eq.${id}`},
        p=>setAttendance(prev=>[p.new,...prev]))
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[id])

  useEffect(()=>{
    const ch = supabase.channel(`ses-${id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'sessions',filter:`id=eq.${id}`},
        p=>{ setSession(p.new); if(p.new.qr_config) setQrConfig(p.new.qr_config) })
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[id])

  const saveQr = async cfg => { setQrConfig(cfg); await supabase.from('sessions').update({qr_config:cfg}).eq('id',id) }
  const copyUrl = () => { navigator.clipboard.writeText(attendUrl); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  const downloadQR = () => {
    const svg = document.getElementById('qr-main'); if(!svg) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`qr-${session?.name||id}.svg`; a.click()
  }
  const endSession = async () => {
    setEnding(true); await supabase.from('sessions').update({status:'ended'}).eq('id',id); setEnding(false); setShowEndModal(false)
  }

  const handleFile = async file => {
    if(!file) return; setUploading(true)
    try {
      const buf=await file.arrayBuffer(); let rows=[]
      if(file.name.endsWith('.csv')) {
        const lines=new TextDecoder().decode(buf).trim().split(/\r?\n/).filter(Boolean)
        const header=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/["\r]/g,''))
        const ii=header.findIndex(h=>h.includes('id')||h.includes('number')||h.includes('no')||h.includes('رقم'))
        const ni=header.findIndex(h=>h.includes('name')||h.includes('اسم'))
        rows=lines.slice(1).map(l=>{const c=l.split(',').map(x=>x.trim().replace(/["\r]/g,'')); return {id:c[ii>=0?ii:0]||'',name:c[ni>=0?ni:1]||''}})
      } else {
        const wb=XLSX.read(buf,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]
        const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:''})
        if(data.length<2){alert('File needs header row + data.'); return}
        const header=data[0].map(h=>String(h||'').toLowerCase().trim())
        const ii=header.findIndex(h=>h.includes('id')||h.includes('number')||h.includes('no')||h.includes('رقم'))
        const ni=header.findIndex(h=>h.includes('name')||h.includes('اسم'))
        rows=data.slice(1).filter(r=>r.some(Boolean)).map(r=>({id:String(r[ii>=0?ii:0]||'').trim(),name:String(r[ni>=0?ni:1]||'').trim()}))
      }
      const students=rows.filter(r=>r.id)
      if(!students.length){alert(isAr?'لم يتم العثور على طلاب. تحقق من رؤوس الأعمدة.':'No students found. Check column headers.'); return}
      await supabase.from('sessions').update({students}).eq('id',id)
      setSession(p=>({...p,students}))
      alert(`✅ ${isAr?'تم رفع':'Uploaded'} ${students.length} ${isAr?'طالب':'students!'}`)
    } catch(e){alert('Error: '+e.message)} finally{setUploading(false)}
  }

  const addStudent = async () => {
    const sid=manualId.trim().toUpperCase(); if(!sid) return
    const existing=session?.students||[]
    if(existing.some(s=>s.id.toUpperCase()===sid)){alert(isAr?'الطالب موجود بالفعل.':'Already in roster.'); return}
    setAddingStudent(true)
    const updated=[...existing,{id:sid,name:manualName.trim()}]
    await supabase.from('sessions').update({students:updated}).eq('id',id)
    setSession(p=>({...p,students:updated})); setManualId(''); setManualName(''); setAddingStudent(false)
  }

  const removeStudent = async sid => {
    const updated=(session?.students||[]).filter(s=>s.id!==sid)
    await supabase.from('sessions').update({students:updated}).eq('id',id); setSession(p=>({...p,students:updated}))
  }

  if(!session) return <div className="loading-screen"><div className="spinner"/></div>

  const rosterCount = session.students?.length||0
  const pct = rosterCount>0 ? Math.min(100,Math.round((attendance.length/rosterCount)*100)) : 0

  return (
    <div className="page" dir={isAr?'rtl':'ltr'}>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="back-btn" onClick={()=>navigate('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={isAr?"9 18 15 12 9 6":"15 18 9 12 15 6"}/></svg>
          </button>
          <div className="navbar-title">{isAr&&session.name_ar?session.name_ar:session.name}</div>
        </div>
        <div className="navbar-right">
          <span className={`badge ${session.status==='active'?'badge-active badge-dot':session.status==='scheduled'?'badge-scheduled':'badge-ended'}`}>
            {session.status==='active'?tr('live'):session.status==='scheduled'?tr('scheduled'):tr('ended')}
          </span>
          <button className="icon-btn" onClick={()=>navigate(`/report/${id}`)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
        </div>
      </nav>

      <div className="session-content">
        <div className="tabs" style={{marginBottom:13}}>
          <button className={`tab-btn ${tab==='qr'?'active':''}`} onClick={()=>setTab('qr')}>QR</button>
          <button className={`tab-btn ${tab==='live'?'active':''}`} onClick={()=>setTab('live')}>
            {tr('live')} {attendance.length>0&&<span className="tab-count">{attendance.length}</span>}
          </button>
          <button className={`tab-btn ${tab==='roster'?'active':''}`} onClick={()=>setTab('roster')}>
            {isAr?'الطلاب':'Roster'} {rosterCount>0&&<span className="tab-count">{rosterCount}</span>}
          </button>
        </div>

        {tab==='qr' && (
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            <div className="count-live">
              <div>
                <div className="count-num">{attendance.length}</div>
                <div className="count-label">{tr('checkedIn')}</div>
                {rosterCount>0 && <div className="count-sub">{isAr?'من':'of'} {rosterCount}</div>}
              </div>
              {rosterCount>0 && (
                <div style={{flex:1,marginLeft:14}}>
                  <div style={{fontSize:24,fontWeight:800,textAlign:isAr?'left':'right',fontFamily:'Playfair Display,serif'}}>{pct}%</div>
                  <div className="progress-bar" style={{marginTop:6}}><div className="progress-fill" style={{width:`${pct}%`}}/></div>
                </div>
              )}
            </div>

            <div className="qr-panel">
              <div className="qr-wrapper">
                <div className="qr-session-label">{isAr?'امسح للتسجيل في':'Scan to check in to'} <strong>{isAr&&session.name_ar?session.name_ar:session.name}</strong></div>
                <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="296" height="296" style={{position:'absolute',top:-6,left:-6,transform:'rotate(-90deg)'}}>
                    <circle cx="148" cy="148" r="144" fill="none" stroke="var(--bg-3)" strokeWidth="4"/>
                    <circle cx="148" cy="148" r="144" fill="none" stroke={timerColor} strokeWidth="4"
                      strokeDasharray={`${2*Math.PI*144}`}
                      strokeDashoffset={`${2*Math.PI*144*(1-secondsLeft/30)}`}
                      style={{transition:'stroke-dashoffset 1s linear,stroke .5s'}}/>
                  </svg>
                  <div className="qr-frame" style={{background:qrConfig.bgColor}}>
                    <QRCode id="qr-main" value={attendUrl} size={qrConfig.size} fgColor={qrConfig.fgColor} bgColor={qrConfig.bgColor} level={qrConfig.level}/>
                  </div>
                </div>
                {isFixed ? (
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'var(--bg-3)',borderRadius:40,border:'1px solid var(--success)'}}>
                    <span style={{fontSize:13}}>📌</span>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--success)'}}>{isAr ? 'رمز QR ثابت' : 'Fixed QR'}</span>
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'var(--bg-3)',borderRadius:40,border:`1px solid ${timerColor}`}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{fontSize:13,fontWeight:700,color:timerColor,fontFamily:'monospace'}}>{secondsLeft}s</span>
                    <span style={{fontSize:11,color:'var(--text-3)'}}>{tr('untilRefresh')}</span>
                  </div>
                )}
                <div style={{fontSize:11,color:'var(--text-3)',textAlign:'center',maxWidth:260,lineHeight:1.5}}>
                  {isFixed ? (isAr ? '📌 رمز لا يتغير — مناسب لبيئات WiFi الضعيفة' : '📌 Never changes — best for weak WiFi') : `🔒 ${tr('qrRefreshes')} (${qrInterval}s)`}
                </div>
                <div className="qr-url-row">
                  <span className="qr-url-text">{attendUrl}</span>
                  <button className="btn btn-secondary btn-sm" onClick={copyUrl} style={{flexShrink:0}}>{copied?'✓':'Copy'}</button>
                  <button className="btn btn-secondary btn-sm" onClick={downloadQR} style={{flexShrink:0}}>Save</button>
                </div>
              </div>
              <div className="qr-customize">
                <button className={`qr-customize-toggle ${showQRCust?'open':''}`} onClick={()=>setShowQRCust(v=>!v)}>
                  {isAr?'تخصيص رمز QR':'Customize QR'}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showQRCust && (
                  <div className="qr-settings">
                    <div className="input-group"><label className="input-label">Foreground</label>
                      <div style={{display:'flex',alignItems:'center',gap:8}}><input type="color" className="color-swatch" value={qrConfig.fgColor} onChange={e=>saveQr({...qrConfig,fgColor:e.target.value})}/><span style={{fontSize:11,color:'var(--text-3)',fontFamily:'monospace'}}>{qrConfig.fgColor}</span></div>
                    </div>
                    <div className="input-group"><label className="input-label">Background</label>
                      <div style={{display:'flex',alignItems:'center',gap:8}}><input type="color" className="color-swatch" value={qrConfig.bgColor} onChange={e=>saveQr({...qrConfig,bgColor:e.target.value})}/><span style={{fontSize:11,color:'var(--text-3)',fontFamily:'monospace'}}>{qrConfig.bgColor}</span></div>
                    </div>
                    <div className="input-group"><label className="input-label">Size: {qrConfig.size}px</label>
                      <input type="range" min="160" max="360" step="8" value={qrConfig.size} onChange={e=>saveQr({...qrConfig,size:+e.target.value})} style={{width:'100%',accentColor:'var(--accent)'}}/>
                    </div>
                    <div className="input-group"><label className="input-label">Error Level</label>
                      <select className="input" value={qrConfig.level} onChange={e=>saveQr({...qrConfig,level:e.target.value})}>
                        <option value="L">L – Low</option><option value="M">M – Medium</option><option value="Q">Q – High</option><option value="H">H – Max</option>
                      </select>
                    </div>
                    <div style={{gridColumn:'1/-1'}}><button className="btn btn-ghost btn-sm" onClick={()=>saveQr({fgColor:'#1a3a2a',bgColor:'#ffffff',size:256,level:'H'})}>Reset</button></div>
                  </div>
                )}
              </div>
            </div>

            {session.status==='active' && <button className="btn btn-danger btn-full" onClick={()=>setShowEndModal(true)}>🔒 {tr('endSession')}</button>}
            {session.status==='scheduled' && (
              <div style={{background:'var(--yellow-dim)',border:'1px solid rgba(212,160,23,.2)',borderRadius:10,padding:'12px 14px',fontSize:12,color:'var(--yellow)',textAlign:'center'}}>
                ⏰ {isAr?'هذه الجلسة مجدولة وستفتح تلقائياً في الوقت المحدد.':'This session is scheduled and will open automatically at the set time.'}
              </div>
            )}
          </div>
        )}

        {tab==='live' && (
          attendance.length===0 ? (
            <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">{tr('waitingForStudents')}</div><div className="empty-text">{tr('checkInsAppearHere')}</div></div>
          ) : attendance.map((a,i) => (
            <div key={a.id} className="attend-item" style={{animationDelay:`${i*.03}s`}}>
              <div className="attend-avatar">
                {a.photo_data ? <img src={a.photo_data} alt={a.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/> : initials(a.name||a.student_id)}
              </div>
              <div><div className="attend-name">{a.name||'—'}</div><div className="attend-id">{a.student_id}</div></div>
              <div style={{textAlign:'right',marginLeft:'auto',flexShrink:0}}>
                <div className="attend-time">{fmtTime(a.checked_in_at)}</div>
                {a.offline_submitted && <div style={{fontSize:10,color:'var(--yellow)'}}>📶 synced</div>}
              </div>
            </div>
          ))
        )}

        {tab==='roster' && (
          <div>
            <div className="upload-zone"
              onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('drag-over')}}
              onDragLeave={e=>e.currentTarget.classList.remove('drag-over')}
              onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');handleFile(e.dataTransfer.files[0])}}>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={e=>handleFile(e.target.files[0])}/>
              <div className="upload-icon">{uploading?'⏳':'📂'}</div>
              <div className="upload-title">{uploading?'…':tr('uploadRoster')}</div>
              <div className="upload-hint">{tr('uploadHint')}</div>
            </div>
            <div style={{marginTop:13}}>
              <div className="section-title" style={{marginBottom:7}}>{tr('addManually')}</div>
              <div style={{display:'flex',gap:6}}>
                <input className="input" placeholder={isAr?'الرقم':'ID'} value={manualId} onChange={e=>setManualId(e.target.value)} style={{flex:'0 0 90px'}} onKeyDown={e=>e.key==='Enter'&&addStudent()}/>
                <input className="input" placeholder={isAr?'الاسم الكامل':'Full Name'} value={manualName} onChange={e=>setManualName(e.target.value)} style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&addStudent()}/>
                <button className="btn btn-primary btn-sm" onClick={addStudent} disabled={!manualId.trim()||addingStudent}>{addingStudent?'…':isAr?'إضافة':'Add'}</button>
              </div>
            </div>
            {rosterCount>0 && (
              <div style={{marginTop:14}}>
                <div className="section-header">
                  <span className="section-title">{rosterCount} {tr('students')}</span>
                  <button className="btn btn-ghost btn-sm" onClick={async()=>{if(!confirm(isAr?'مسح جميع الطلاب؟':'Clear all students?'))return; await supabase.from('sessions').update({students:[]}).eq('id',id); setSession(p=>({...p,students:[]}))}}>
                    {tr('clearAll')}
                  </button>
                </div>
                {session.students.map((s,i)=>{
                  const checked = attendance.some(a=>a.student_id===s.id.toUpperCase()||a.student_id===s.id)
                  return (
                    <div key={s.id} className="roster-item" style={{animationDelay:`${i*.02}s`}}>
                      <div className="attend-avatar" style={{width:32,height:32,fontSize:11}}>{initials(s.name)}</div>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{s.name||'—'}</div><div style={{fontSize:11,color:'var(--text-3)',fontFamily:'monospace'}}>{s.id}</div></div>
                      <span className={`badge ${checked?'badge-active':'badge-ended'}`}>{checked?tr('present'):tr('absent')}</span>
                      <button className="btn btn-ghost btn-icon" onClick={()=>removeStudent(s.id)} style={{color:'var(--red)',padding:5}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showEndModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowEndModal(false)}>
          <div className="modal" style={{textAlign:'center',padding:'26px 18px'}}>
            <div style={{fontSize:34,marginBottom:10}}>🔒</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:5}}>{tr('endSession')}?</div>
            <div style={{fontSize:12,color:'var(--text-3)',marginBottom:18}}>{tr('endSessionConfirm')}</div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={()=>setShowEndModal(false)}>{tr('cancel')}</button>
              <button className="btn btn-primary" onClick={endSession} disabled={ending}>{ending?'…':tr('endSession')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
