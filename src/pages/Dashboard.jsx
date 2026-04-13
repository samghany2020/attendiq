import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useT } from '../i18n'

const today   = () => new Date().toISOString().split('T')[0]
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ''
const fmtDT   = dt => dt ? new Date(dt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : ''
const getTimeLeft = dt => {
  if (!dt) return null
  const diff = new Date(dt) - new Date()
  if (diff <= 0) return null
  const mins = Math.floor(diff/60000), hrs = Math.floor(mins/60)
  return hrs > 0 ? `${hrs}h ${mins%60}m` : `${mins}m`
}

const IcoSession  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IcoCourse   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
const IcoReport   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
const IcoHistory  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IcoSettings = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
const IcoTrash    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const IcoPlus     = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoAdmin    = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="9" fill="url(#dbl)"/>
    <path d="M14 20L17 23L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <defs><linearGradient id="dbl" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#1a4731"/><stop offset="1" stopColor="#0f2d1e"/></linearGradient></defs>
  </svg>
)
const StatusBadge = ({ s, tr }) => {
  if (s.status==='active') return <span className="badge badge-active badge-dot">{tr('live')}</span>
  if (s.status==='ended')  return <span className="badge badge-ended">{tr('ended')}</span>
  const left = getTimeLeft(s.scheduled_start)
  return <span className="badge badge-scheduled">{left ? `⏰ ${left}` : tr('scheduled')}</span>
}

export default function Dashboard() {
  const { user, logout, displayName, lang, isAdmin } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate  = useNavigate()
  const tr        = useT(lang)
  const isAr      = lang === 'ar'

  // Store userId in a ref so it never triggers re-renders
  const userIdRef = useRef(user?.id)

  const [tab,      setTab]      = useState('sessions')
  const [sessions, setSessions] = useState([])
  const [courses,  setCourses]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showCourseModal,  setShowCourseModal]  = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [errMsg,  setErrMsg]  = useState('')
  const [sessionForm, setSessionForm] = useState({
    name:'', nameAr:'', subject:'', subjectAr:'',
    date:today(), courseId:'', scheduledStart:'', scheduledEnd:'',
    qrMode:'rotating', qrInterval:30,
  })
  const [courseForm, setCourseForm] = useState({ name:'', nameAr:'', code:'' })

  // ── Load ONCE on mount only — never re-runs ──────────────
  useEffect(() => {
    const uid = userIdRef.current
    if (!uid) return

    const doLoad = async () => {
      setLoading(true)
      try {
        try { await supabase.rpc('sync_session_status') } catch(_){}
        const [{ data: s }, { data: c }] = await Promise.all([
          supabase.from('sessions').select('*').eq('teacher_uid', uid).order('created_at', { ascending: false }),
          supabase.from('courses').select('*').eq('teacher_uid', uid).order('created_at', { ascending: false }),
        ])
        setSessions(s || [])
        setCourses(c  || [])
      } catch (err) {
        console.error('Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    doLoad()
  }, []) // ← EMPTY array — runs only once, never re-runs

  // ── Create session ────────────────────────────────────────
  const createSession = async e => {
    e.preventDefault()
    if (!sessionForm.name.trim()) return
    setSaving(true); setErrMsg('')
    const uid = userIdRef.current
    try {
      const { data, error } = await supabase.from('sessions').insert({
        name:            sessionForm.name.trim(),
        name_ar:         sessionForm.nameAr.trim() || null,
        subject:         sessionForm.subject.trim(),
        subject_ar:      sessionForm.subjectAr.trim() || null,
        date:            sessionForm.date,
        course_id:       sessionForm.courseId || null,
        scheduled_start: sessionForm.scheduledStart ? new Date(sessionForm.scheduledStart).toISOString() : null,
        scheduled_end:   sessionForm.scheduledEnd   ? new Date(sessionForm.scheduledEnd).toISOString()   : null,
        teacher_uid:     uid,
        teacher_name:    displayName,
        status:          sessionForm.scheduledStart ? 'scheduled' : 'active',
        students:        [],
        qr_config:       { fgColor:'#1a3a2a', bgColor:'#ffffff', size:256, level:'H' },
      }).select().single()

      if (error) {
        setErrMsg(`${error.message} (${error.code})`)
        console.error('Session error:', error)
      } else if (data) {
        // Add to top of list immediately
        setSessions(prev => [data, ...prev])
        setShowSessionModal(false)
        setSessionForm({ name:'', nameAr:'', subject:'', subjectAr:'', date:today(), courseId:'', scheduledStart:'', scheduledEnd:'' })
        navigate(`/session/${data.id}`)
      }
    } catch (err) {
      setErrMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Create course ─────────────────────────────────────────
  const createCourse = async e => {
    e.preventDefault()
    if (!courseForm.name.trim()) return
    setSaving(true); setErrMsg('')
    const uid = userIdRef.current
    try {
      const { data, error } = await supabase.from('courses').insert({
        name:        courseForm.name.trim(),
        name_ar:     courseForm.nameAr.trim() || null,
        code:        courseForm.code.trim(),
        teacher_uid: uid,
      }).select().single()

      if (error) {
        setErrMsg(`${error.message} (${error.code})`)
        console.error('Course error:', error)
      } else if (data) {
        // Add to list immediately — NO database reload
        setCourses(prev => [data, ...prev])
        setShowCourseModal(false)
        setCourseForm({ name:'', nameAr:'', code:'' })
      }
    } catch (err) {
      setErrMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteItem) return
    const { type, id } = deleteItem
    setDeleteItem(null)
    if (type === 'session') {
      setSessions(prev => prev.filter(s => s.id !== id))
      await supabase.from('sessions').delete().eq('id', id)
    }
    if (type === 'course') {
      setCourses(prev => prev.filter(c => c.id !== id))
      await supabase.from('courses').delete().eq('id', id)
    }
  }

  const firstName      = displayName.split(' ')[0]
  const activeCount    = sessions.filter(s => s.status === 'active').length
  const scheduledCount = sessions.filter(s => s.status === 'scheduled').length

  return (
    <div className="page" dir={isAr ? 'rtl' : 'ltr'}>
      <nav className="navbar">
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <Logo/>
          <span style={{ fontFamily:'Playfair Display,serif', fontSize:16, fontWeight:700, color:'var(--text-1)' }}>AttendIQ</span>
        </div>
        <div className="navbar-right">
          <div className="user-pill">
            <div className="user-avatar">{firstName[0].toUpperCase()}</div>
            <span className="user-name">{firstName}</span>
          </div>
          <button className="icon-btn" onClick={toggle}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="icon-btn" onClick={() => navigate('/settings')}><IcoSettings/></button>
          {isAdmin && <button className="icon-btn" onClick={() => navigate('/admin')}><IcoAdmin/></button>}
          <button className="icon-btn" onClick={logout}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </nav>

      <div className="page-inner">
        {errMsg && (
          <div className="form-error" style={{ margin:'10px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>⚠️ {errMsg}</span>
            <button onClick={() => setErrMsg('')} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontWeight:700 }}>✕</button>
          </div>
        )}

        <div className="dash-header">
          <div style={{ fontSize:20, fontWeight:800, fontFamily:'Playfair Display,serif' }}>
            {tr('hello')}, <span className="text-gold">{firstName}</span> 👋
          </div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3 }}>
            {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday:'long', day:'numeric', month:'long' })}
          </div>
        </div>

        <div className="stat-bar">
          <div className="stat-card">
            <div className="stat-num">{sessions.length}</div>
            <div className="stat-label">{tr('sessions')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color:'var(--success)' }}>{activeCount}</div>
            <div className="stat-label">{tr('active')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color:'var(--yellow)' }}>{scheduledCount}</div>
            <div className="stat-label">{tr('scheduled')}</div>
          </div>
        </div>

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          loading
            ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
            : sessions.length === 0
              ? <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">{tr('noSessionsYet')}</div><div className="empty-text">{tr('tapToCreate')}</div></div>
              : sessions.map((s, i) => (
                  <div key={s.id} className="item-card" style={{ animationDelay:`${i * .04}s` }}>
                    <div className="item-card-top">
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="item-card-name">{isAr && s.name_ar ? s.name_ar : s.name}</div>
                        {(isAr ? s.subject_ar || s.subject : s.subject) && (
                          <div className="item-card-sub">{isAr ? s.subject_ar || s.subject : s.subject}</div>
                        )}
                      </div>
                      <StatusBadge s={s} tr={tr}/>
                    </div>
                    {(s.scheduled_start || s.scheduled_end) && (
                      <div className="schedule-bar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <div style={{ fontSize:11 }}>
                          {s.scheduled_start && <span>{tr('autoOpens')}: <span className="time">{fmtDT(s.scheduled_start)}</span></span>}
                          {s.scheduled_start && s.scheduled_end && ' · '}
                          {s.scheduled_end   && <span>{tr('autoCloses')}: <span className="time">{fmtDT(s.scheduled_end)}</span></span>}
                          {s.status === 'scheduled' && getTimeLeft(s.scheduled_start) && (
                            <span style={{ color:'var(--accent)', fontWeight:600 }}> · {tr('upcomingIn')} {getTimeLeft(s.scheduled_start)}</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="item-card-meta">
                      <span className="meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fmtDate(s.date)}
                      </span>
                    </div>
                    <div className="item-card-actions">
                      <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={() => navigate(`/session/${s.id}`)}>
                        {s.status === 'active' ? tr('manage') : tr('view')}
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={() => navigate(`/report/${s.id}`)}>
                        {tr('report')}
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteItem({ type:'session', id:s.id })}><IcoTrash/></button>
                    </div>
                  </div>
                ))
        )}

        {/* Courses Tab */}
        {tab === 'courses' && (
          loading
            ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
            : courses.length === 0
              ? <div className="empty-state"><div className="empty-icon">📚</div><div className="empty-title">{tr('noCoursesYet')}</div><div className="empty-text">{isAr ? 'اضغط + لإضافة مقرر' : 'Tap + to add a course'}</div></div>
              : courses.map((c, i) => (
                  <div key={c.id} className="item-card" style={{ animationDelay:`${i * .04}s` }}>
                    <div className="item-card-top">
                      <div>
                        <div className="item-card-name">{isAr && c.name_ar ? c.name_ar : c.name}</div>
                        {c.code && <div className="item-card-sub">{c.code}</div>}
                      </div>
                      <span className="badge badge-gold">{sessions.filter(s => s.course_id === c.id).length} {tr('sessions')}</span>
                    </div>
                    <div className="item-card-actions">
                      <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={() => navigate(`/course/${c.id}/roster`)}>
                        👥 {isAr ? 'الطلاب' : 'Roster'}
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteItem({ type:'course', id:c.id })}><IcoTrash/></button>
                    </div>
                  </div>
                ))
        )}

        {/* Reports Tab */}
        {tab === 'reports' && (
          sessions.filter(s => s.status === 'ended').length === 0
            ? <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">{tr('noReportsYet')}</div><div className="empty-text">{tr('reportsAppearAfter')}</div></div>
            : sessions.filter(s => s.status === 'ended').map((s, i) => (
                <div key={s.id} className="item-card" style={{ animationDelay:`${i * .04}s` }}>
                  <div className="item-card-top">
                    <div>
                      <div className="item-card-name">{isAr && s.name_ar ? s.name_ar : s.name}</div>
                      {(isAr ? s.subject_ar || s.subject : s.subject) && (
                        <div className="item-card-sub">{isAr ? s.subject_ar || s.subject : s.subject}</div>
                      )}
                    </div>
                    <span className="badge badge-ended">{tr('ended')}</span>
                  </div>
                  <div className="item-card-meta">
                    <span className="meta-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {fmtDate(s.date)}
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm btn-full" onClick={() => navigate(`/report/${s.id}`)}>{tr('report')} →</button>
                </div>
              ))
        )}
      </div>

      {/* FAB */}
      {(tab === 'sessions' || tab === 'courses') && (
        <button className="fab" onClick={() => tab === 'courses' ? setShowCourseModal(true) : setShowSessionModal(true)}>
          <IcoPlus/>
        </button>
      )}

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}><IcoSession/><span>{tr('sessions')}</span></button>
        <button className={`nav-item ${tab === 'courses'  ? 'active' : ''}`} onClick={() => setTab('courses')}><IcoCourse/><span>{tr('courses')}</span></button>
        <button className={`nav-item ${tab === 'reports'  ? 'active' : ''}`} onClick={() => setTab('reports')}><IcoReport/><span>{tr('reports')}</span></button>
        <button className="nav-item" onClick={() => navigate('/history')}><IcoHistory/><span>{tr('history')}</span></button>
      </nav>

      {/* New Session Modal */}
      {showSessionModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSessionModal(false)}>
          <div className="modal">
            <div className="modal-title">
              {tr('newSession')}
              <button className="icon-btn" onClick={() => setShowSessionModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={createSession}>
              <div className="input-group">
                <label className="input-label">{tr('sessionName')} *</label>
                <input className="input" placeholder="CS101 – Lecture 5" value={sessionForm.name} onChange={e => setSessionForm(f => ({ ...f, name:e.target.value }))} required autoFocus/>
              </div>
              <div className="input-group">
                <label className="input-label">اسم الجلسة (عربي)</label>
                <input className="input" placeholder="محاضرة 5" value={sessionForm.nameAr} onChange={e => setSessionForm(f => ({ ...f, nameAr:e.target.value }))} dir="rtl"/>
              </div>
              <div className="input-row">
                <div className="input-group">
                  <label className="input-label">{tr('subject')}</label>
                  <input className="input" placeholder="Computer Science" value={sessionForm.subject} onChange={e => setSessionForm(f => ({ ...f, subject:e.target.value }))}/>
                </div>
                <div className="input-group">
                  <label className="input-label">المادة</label>
                  <input className="input" placeholder="علم الحاسوب" value={sessionForm.subjectAr} onChange={e => setSessionForm(f => ({ ...f, subjectAr:e.target.value }))} dir="rtl"/>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">{tr('date')}</label>
                <input className="input" type="date" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date:e.target.value }))} required/>
              </div>
              <div style={{ background:'var(--yellow-dim)', border:'1px solid rgba(212,160,23,.2)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--yellow)', marginBottom:8 }}>
                  ⏰ {isAr ? 'جدولة تلقائية' : 'Auto Schedule'} <span style={{ fontWeight:400, color:'var(--text-3)' }}>({isAr ? 'اختياري' : 'optional'})</span>
                </div>
                <div className="input-row">
                  <div className="input-group">
                    <label className="input-label">{tr('scheduledStart')}</label>
                    <input className="input" type="datetime-local" value={sessionForm.scheduledStart} onChange={e => setSessionForm(f => ({ ...f, scheduledStart:e.target.value }))}/>
                  </div>
                  <div className="input-group">
                    <label className="input-label">{tr('scheduledEnd')}</label>
                    <input className="input" type="datetime-local" value={sessionForm.scheduledEnd} onChange={e => setSessionForm(f => ({ ...f, scheduledEnd:e.target.value }))}/>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:7 }}>
                  {isAr ? 'إذا حددت وقتاً، ستفتح/تغلق الجلسة تلقائياً.' : 'If set, the session opens and closes automatically.'}
                </div>
              </div>
              {/* QR Settings */}
              <div style={{ background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:8 }}>
                  📱 {isAr ? 'إعدادات رمز QR' : 'QR Code Settings'}
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                  {[['rotating', isAr ? '🔄 دوّار' : '🔄 Rotating'], ['fixed', isAr ? '📌 ثابت' : '📌 Fixed']].map(([v, l]) => (
                    <button key={v} type="button"
                      className={`btn btn-sm ${sessionForm.qrMode === v ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex:1 }}
                      onClick={() => setSessionForm(f => ({ ...f, qrMode:v }))}>
                      {l}
                    </button>
                  ))}
                </div>
                {sessionForm.qrMode === 'rotating' && (
                  <div className="input-group">
                    <label className="input-label">{isAr ? 'وقت التجديد (ثانية)' : 'Rotation interval (seconds)'}</label>
                    <div style={{ display:'flex', gap:6 }}>
                      {[15, 30, 60, 120].map(v => (
                        <button key={v} type="button"
                          className={`btn btn-sm ${sessionForm.qrInterval === v ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setSessionForm(f => ({ ...f, qrInterval:v }))}>
                          {v}s
                        </button>
                      ))}
                      <input type="number" className="input" min="10" max="600" style={{ width:70 }}
                        value={sessionForm.qrInterval}
                        onChange={e => setSessionForm(f => ({ ...f, qrInterval:parseInt(e.target.value)||30 }))}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginTop:4 }}>
                      {isAr ? 'الافتراضي 30 ثانية — يمكنك تخصيصه' : 'Default 30s — customizable. Fixed QR never expires.'}
                    </div>
                  </div>
                )}
                {sessionForm.qrMode === 'fixed' && (
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>
                    📌 {isAr ? 'رمز QR ثابت لا يتغير — مناسب لبيئات WiFi ضعيف' : 'Fixed QR never changes — best for weak WiFi areas.'}
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">{tr('linkToCourse')}</label>
                <select className="input" value={sessionForm.courseId} onChange={e => setSessionForm(f => ({ ...f, courseId:e.target.value }))}>
                  <option value="">{tr('noCourse')}</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                </select>
                {sessionForm.courseId && (
                  <div style={{ fontSize:11, color:'var(--success)', marginTop:4 }}>
                    ✨ {isAr
                      ? `سيتم نقل طلاب المقرر (${courses.find(c=>c.id===sessionForm.courseId)?.name || ''}) للجلسة تلقائياً`
                      : `Students from ${courses.find(c=>c.id===sessionForm.courseId)?.name || 'this course'} will be auto-added`}
                  </div>
                )}
                {courses.length === 0 && (
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>
                    {isAr ? 'أنشئ مقرراً أولاً من تبويب المقررات' : 'Create a course first from the Courses tab'}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSessionModal(false)}>{tr('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : tr('createAndOpen')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Course Modal */}
      {showCourseModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCourseModal(false)}>
          <div className="modal">
            <div className="modal-title">
              {tr('newCourse')}
              <button className="icon-btn" onClick={() => setShowCourseModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={createCourse}>
              <div className="input-group">
                <label className="input-label">{tr('courseName')} *</label>
                <input className="input" placeholder="Introduction to Computer Science" value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name:e.target.value }))} required autoFocus/>
              </div>
              <div className="input-group">
                <label className="input-label">اسم المقرر (عربي)</label>
                <input className="input" placeholder="مقدمة في علم الحاسوب" value={courseForm.nameAr} onChange={e => setCourseForm(f => ({ ...f, nameAr:e.target.value }))} dir="rtl"/>
              </div>
              <div className="input-group">
                <label className="input-label">{tr('courseCode')}</label>
                <input className="input" placeholder="CS101" value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code:e.target.value }))}/>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>{tr('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : isAr ? 'إنشاء' : 'Create Course'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteItem(null)}>
          <div className="modal" style={{ textAlign:'center', padding:'26px 18px' }}>
            <div style={{ fontSize:34, marginBottom:10 }}>🗑️</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:5 }}>{tr('delete')} {deleteItem.type}?</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:18 }}>
              {isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This cannot be undone.'}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteItem(null)}>{tr('cancel')}</button>
              <button className="btn btn-danger"    onClick={confirmDelete}>{tr('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}