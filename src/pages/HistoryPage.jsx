import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
const fmtDate=(d)=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''
const fmtTime=(ts)=>ts?new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):''
export default function HistoryPage() {
  const { user, lang } = useAuth()
  const navigate = useNavigate()
  const isAr = lang==='ar'
  const [sessions,setSessions]=useState([])
  const [attendance,setAttendance]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState('all')
  useEffect(()=>{
    const load=async()=>{
      const {data:s}=await supabase.from('sessions').select('id,name,name_ar,subject,date,status').eq('teacher_uid',user.id).order('created_at',{ascending:false})
      setSessions(s||[])
      if(s?.length){
        const {data:a}=await supabase.from('attendance').select('*').in('session_id',s.map(x=>x.id)).order('checked_in_at',{ascending:false})
        setAttendance(a||[])
      }
      setLoading(false)
    }
    if(user) load()
  },[user])
  const sessionMap=Object.fromEntries(sessions.map(s=>[s.id,s]))
  const filtered=attendance.filter(a=>{
    const mf=selected==='all'||a.session_id===selected
    const ms=!search||a.name?.toLowerCase().includes(search.toLowerCase())||a.student_id?.toLowerCase().includes(search.toLowerCase())
    return mf&&ms
  })
  const initials=(name)=>name?name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase():'?'
  return (
    <div className="page" dir={isAr?'rtl':'ltr'}>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="back-btn" onClick={()=>navigate('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={isAr?"9 18 15 12 9 6":"15 18 9 12 15 6"}/></svg>
          </button>
          <div className="navbar-title">{isAr?'سجل الحضور':'Attendance History'}</div>
        </div>
        <span className="badge badge-gold">{attendance.length} {isAr?'سجل':'records'}</span>
      </nav>
      <div className="page-inner">
        <div style={{paddingTop:14,marginBottom:14,display:'flex',flexDirection:'column',gap:8}}>
          <input className="input" placeholder={isAr?'بحث بالاسم أو الرقم…':'Search by name or student ID…'} value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="all">{isAr?`جميع الجلسات (${sessions.length})`:`All Sessions (${sessions.length})`}</option>
            {sessions.map(s=><option key={s.id} value={s.id}>{isAr&&s.name_ar?s.name_ar:s.name} — {fmtDate(s.date)}</option>)}
          </select>
        </div>
        {loading?<div style={{textAlign:'center',padding:40}}><div className="spinner" style={{margin:'0 auto'}}/></div>
        :filtered.length===0?<div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-title">{isAr?'لا توجد نتائج':'No records found'}</div></div>
        :filtered.map((a,i)=>{
          const ses=sessionMap[a.session_id]
          return(
            <div key={a.id} className="attend-item" style={{animationDelay:`${i*.02}s`,cursor:'pointer'}} onClick={()=>navigate(`/session/${a.session_id}`)}>
              <div className="attend-avatar">
                {a.photo_data?<img src={a.photo_data} alt={a.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>:initials(a.name||a.student_id)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div className="attend-name">{a.name||'—'}</div>
                <div className="attend-id">{a.student_id}</div>
                {ses&&<div style={{fontSize:11,color:'var(--accent)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{isAr&&ses.name_ar?ses.name_ar:ses.name}</div>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div className="attend-time">{fmtTime(a.checked_in_at)}</div>
                {ses&&<div style={{fontSize:10,color:'var(--text-3)',marginTop:1}}>{fmtDate(ses.date)}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}