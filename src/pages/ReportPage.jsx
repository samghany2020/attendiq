
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../i18n'
import { buildReportRows, exportToExcel, exportToPDF } from '../utils/export'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'}) : ''

export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useAuth()
  const tr  = useT(lang)
  const isAr = lang==='ar'

  const [session,setSession]     = useState(null)
  const [attendance,setAttendance] = useState([])
  const [loading,setLoading]     = useState(true)
  const [search,setSearch]       = useState('')
  const [filter,setFilter]       = useState('all')

  useEffect(()=>{
    const load = async () => {
      const [{ data:s },{ data:a }] = await Promise.all([
        supabase.from('sessions').select('*').eq('id',id).single(),
        supabase.from('attendance').select('*').eq('session_id',id).order('checked_in_at',{ascending:true}),
      ])
      if(!s){ navigate('/dashboard'); return }
      setSession(s); setAttendance(a||[]); setLoading(false)
    }
    load()
  },[id])

  useEffect(()=>{
    const ch = supabase.channel(`rpt-${id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'attendance',filter:`session_id=eq.${id}`},
        p=>setAttendance(prev=>[...prev,p.new]))
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[id])

  if(loading) return <div className="loading-screen"><div className="spinner"/></div>

  const rows    = buildReportRows(session, attendance)
  const present = rows.filter(r=>r.status==='Present').length
  const absent  = rows.length - present
  const rate    = rows.length > 0 ? Math.round((present/rows.length)*100) : 0

  const filtered = rows.filter(r => {
    const mf = filter==='all' || r.status.toLowerCase()===filter
    const ms = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  return (
    <div className="page" dir={isAr?'rtl':'ltr'}>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="back-btn" onClick={()=>navigate(`/session/${id}`)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={isAr?"9 18 15 12 9 6":"15 18 9 12 15 6"}/></svg>
          </button>
          <div className="navbar-title">{tr('report')}</div>
        </div>
        <span className={`badge ${session.status==='active'?'badge-active badge-dot':session.status==='scheduled'?'badge-scheduled':'badge-ended'}`}>
          {session.status==='active'?tr('live'):session.status==='scheduled'?tr('scheduled'):tr('ended')}
        </span>
      </nav>

      <div className="page-inner">
        <div style={{padding:'18px 0 13px'}}>
          <div style={{fontSize:20,fontWeight:800,fontFamily:'Playfair Display,serif'}}>{isAr&&session.name_ar?session.name_ar:session.name}</div>
          {(isAr?session.subject_ar||session.subject:session.subject) && <div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>{isAr?session.subject_ar||session.subject:session.subject}</div>}
          <div style={{fontSize:12,color:'var(--text-3)',marginTop:3}}>{fmtDate(session.date)}</div>
          {session.university && <div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>🏛 {session.university}{session.faculty?` · ${session.faculty}`:''}</div>}
        </div>

        <div className="export-row">
          <button className="btn btn-secondary btn-sm" onClick={()=>exportToExcel(session,attendance)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {tr('exportExcel')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={()=>exportToPDF(session,attendance)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
            {tr('exportPdf')}
          </button>
        </div>

        <div className="report-stats">
          <div className="report-stat"><div className="report-stat-num">{rows.length}</div><div className="report-stat-label">{tr('totalStudents')}</div></div>
          <div className="report-stat present"><div className="report-stat-num">{present}</div><div className="report-stat-label">{tr('present')}</div></div>
          <div className="report-stat absent"><div className="report-stat-num">{absent}</div><div className="report-stat-label">{tr('absent')}</div></div>
          <div className="report-stat rate">
            <div className="report-stat-num">{rate}%</div>
            <div className="report-stat-label">{tr('attendanceRate')}</div>
            <div className="progress-bar"><div className="progress-fill" style={{width:`${rate}%`}}/></div>
          </div>
        </div>

        {session.students?.length===0 && attendance.length>0 && (
          <div style={{background:'var(--yellow-dim)',border:'1px solid rgba(212,160,23,.2)',borderRadius:8,padding:'9px 12px',fontSize:12,color:'var(--yellow)',marginBottom:12}}>
            ⚠️ {isAr?'لم يتم رفع قائمة الطلاب — يظهر فقط من سجّل حضوره.':'No roster uploaded — showing check-ins only.'}
          </div>
        )}

        {attendance.some(a=>a.photo_data) && (
          <div style={{marginBottom:14}}>
            <div className="section-title" style={{marginBottom:8}}>{isAr?'صور الطلاب':'Student Photos'}</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {attendance.filter(a=>a.photo_data).map(a=>(
                <div key={a.id} style={{textAlign:'center'}}>
                  <img src={a.photo_data} alt={a.name} style={{width:48,height:48,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--green-border)'}}/>
                  <div style={{fontSize:10,color:'var(--text-3)',marginTop:2,maxWidth:50,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name||a.student_id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>
          <input className="input" placeholder={tr('searchPlaceholder')} value={search} onChange={e=>setSearch(e.target.value)}/>
          <div className="tabs">
            {['all','present','absent'].map(f=>(
              <button key={f} className={`tab-btn ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
                {f==='all'?(isAr?'الكل':'All'):f==='present'?tr('present'):tr('absent')}
                {f!=='all' && <span className="tab-count">{f==='present'?present:absent}</span>}
              </button>
            ))}
          </div>
        </div>

        {rows.length===0 ? (
          <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">{isAr?'لا توجد بيانات بعد':'No data yet'}</div><div className="empty-text">{isAr?'ارفع قائمة طلاب أو انتظر تسجيل الحضور.':'Upload a roster or wait for check-ins.'}</div></div>
        ) : filtered.length===0 ? (
          <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-title">{isAr?'لا توجد نتائج':'No results'}</div></div>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>#</th><th>ID</th><th>{isAr?'الاسم':'Name'}</th><th>{isAr?'المجموعة':'Group'}</th><th>{isAr?'الحالة':'Status'}</th><th>{isAr?'الوقت':'Time'}</th></tr></thead>
              <tbody>
                {filtered.map((r,i)=>(
                  <tr key={r.id+i}>
                    <td style={{color:'var(--text-3)',fontSize:11}}>{i+1}</td>
                    <td style={{fontFamily:'monospace',fontSize:11}}>{r.id}</td>
                    <td style={{fontWeight:600,color:'var(--text-1)'}}>{r.name||'—'}</td>
                    <td style={{fontSize:11}}>{r.group_name ? <span style={{background:'var(--accent-dim)',color:'var(--accent)',padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:600}}>{r.group_name}</span> : '—'}</td>
                    <td>{r.status==='Present'?<span className="status-present">✓ {tr('present')}</span>:<span className="status-absent">✗ {tr('absent')}</span>}</td>
                    <td style={{fontSize:11}}>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
