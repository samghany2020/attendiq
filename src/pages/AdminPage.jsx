import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
export default function AdminPage() {
  const { user, lang } = useAuth()
  const navigate = useNavigate()
  const isAr = lang==='ar'
  const [profiles,setProfiles]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const load=async()=>{setLoading(true); const {data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}); setProfiles(data||[]); setLoading(false)}
  useEffect(()=>{load()},[])
  const toggleAdmin=async(p)=>{
    if(p.id===user.id){alert(isAr?'لا يمكنك تغيير صلاحياتك':'You cannot change your own admin status.'); return}
    const {error}=await supabase.from('profiles').update({is_admin:!p.is_admin}).eq('id',p.id)
    if(!error)setProfiles(prev=>prev.map(x=>x.id===p.id?{...x,is_admin:!x.is_admin}:x))
  }
  const filtered=profiles.filter(p=>!search||p.display_name?.toLowerCase().includes(search.toLowerCase())||p.email?.toLowerCase().includes(search.toLowerCase()))
  const initials=(name)=>name?name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase():'?'
  return (
    <div className="page" dir={isAr?'rtl':'ltr'}>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="back-btn" onClick={()=>navigate('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={isAr?"9 18 15 12 9 6":"15 18 9 12 15 6"}/></svg>
          </button>
          <div className="navbar-title">{isAr?'لوحة الإدارة':'Admin Panel'}</div>
        </div>
        <span className="badge badge-gold">{profiles.length} {isAr?'معلم':'teachers'}</span>
      </nav>
      <div className="page-inner">
        <div style={{paddingTop:16}}>
          <div className="stat-bar">
            <div className="stat-card"><div className="stat-num">{profiles.length}</div><div className="stat-label">{isAr?'معلمون':'Teachers'}</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'var(--accent)'}}>{profiles.filter(p=>p.is_admin).length}</div><div className="stat-label">{isAr?'مديرون':'Admins'}</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'var(--success)'}}>{profiles.filter(p=>!p.is_admin).length}</div><div className="stat-label">{isAr?'عاديون':'Regular'}</div></div>
          </div>
          <input className="input" style={{marginBottom:12}} placeholder={isAr?'بحث…':'Search by name or email…'} value={search} onChange={e=>setSearch(e.target.value)}/>
          {loading?<div style={{textAlign:'center',padding:40}}><div className="spinner" style={{margin:'0 auto'}}/></div>
          :filtered.map((p,i)=>(
            <div key={p.id} style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:12,padding:'13px 15px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:7,animation:'fadeUp .2s ease both',animationDelay:`${i*.04}s`}}>
              <div style={{display:'flex',alignItems:'center',gap:11}}>
                <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,background:p.id===user.id?'linear-gradient(135deg,var(--green),var(--green-2))':'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:p.id===user.id?'#fff':'var(--text-2)'}}>{initials(p.display_name)}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600}}>{p.display_name}{p.id===user.id&&<span style={{fontSize:11,color:'var(--accent)',marginLeft:6}}>(you)</span>}</div>
                  <div style={{fontSize:12,color:'var(--text-3)'}}>{p.email}</div>
                  {p.university&&<div style={{fontSize:11,color:'var(--text-3)'}}>{p.university}</div>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                {p.is_admin&&<span className="badge badge-gold">{isAr?'مدير':'Admin'}</span>}
                {p.id!==user.id&&<button className={`btn btn-sm ${p.is_admin?'btn-danger':'btn-secondary'}`} onClick={()=>toggleAdmin(p)}>{p.is_admin?(isAr?'إزالة':'Remove'):(isAr?'ترقية':'Make Admin')}</button>}
              </div>
            </div>
          ))}
          <div style={{marginTop:20,padding:'14px 16px',background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:12,fontSize:12,color:'var(--accent)'}}>
            💡 {isAr?'لجعل نفسك مديراً، شغّل هذا في Supabase SQL Editor:':'To make yourself admin, run in Supabase SQL Editor:'}<br/>
            <code style={{display:'block',marginTop:6,padding:'6px 10px',background:'rgba(0,0,0,.2)',borderRadius:6,fontFamily:'monospace',fontSize:11,color:'var(--text-1)'}}>UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com';</code>
          </div>
        </div>
      </div>
    </div>
  )
}