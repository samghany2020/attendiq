
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useT } from '../i18n'

export default function SettingsPage() {
  const { profile, updateProfile, logout, displayName, lang } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const tr  = useT(lang)
  const isAr = lang==='ar'

  const [form,setForm] = useState({
    display_name: profile?.display_name || displayName,
    university:   profile?.university   || '',
    faculty:      profile?.faculty      || '',
    department:   profile?.department   || '',
    language:     profile?.language     || 'en',
  })
  const [saving,setSaving] = useState(false)
  const [saved,setSaved]   = useState(false)

  const save = async () => {
    setSaving(true)
    const ok = await updateProfile(form)
    setSaving(false)
    if(ok){ setSaved(true); setTimeout(()=>setSaved(false),2000) }
  }

  return (
    <div className="page" dir={isAr?'rtl':'ltr'}>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="back-btn" onClick={()=>navigate('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={isAr?"9 18 15 12 9 6":"15 18 9 12 15 6"}/></svg>
          </button>
          <div className="navbar-title">{tr('settings')}</div>
        </div>
        <button className="icon-btn" onClick={toggle}>{theme==='dark'?'☀️':'🌙'}</button>
      </nav>

      <div className="page-inner">
        <div style={{paddingTop:16}}>

          <div className="settings-section">
            <div className="settings-section-title">{tr('profileSettings')}</div>
            <div className="card" style={{display:'flex',flexDirection:'column',gap:13}}>
              <div className="input-group">
                <label className="input-label">{tr('displayName')}</label>
                <input className="input" value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">{tr('university')}</label>
                <input className="input" placeholder={isAr?'جامعة الأردن':'University of Jordan'} value={form.university} onChange={e=>setForm(f=>({...f,university:e.target.value}))}/>
              </div>
              <div className="input-row">
                <div className="input-group">
                  <label className="input-label">{tr('faculty')}</label>
                  <input className="input" placeholder={isAr?'كلية الهندسة':'Engineering'} value={form.faculty} onChange={e=>setForm(f=>({...f,faculty:e.target.value}))}/>
                </div>
                <div className="input-group">
                  <label className="input-label">{tr('department')}</label>
                  <input className="input" placeholder={isAr?'حاسوب':'CS'} value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))}/>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">{tr('language')}</div>
            <div className="card">
              <div className="tabs">
                {[{v:'en',l:'English'},{v:'ar',l:'عربي'},{v:'both',l:'EN + عربي'}].map(x=>(
                  <button key={x.v} className={`tab-btn ${form.language===x.v?'active':''}`} onClick={()=>setForm(f=>({...f,language:x.v}))}>{x.l}</button>
                ))}
              </div>
              <div style={{fontSize:12,color:'var(--text-3)',marginTop:9}}>{isAr?'تغيير اللغة يؤثر على الواجهة بأكملها.':'Language affects the entire interface.'}</div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">{isAr?'المظهر':'Appearance'}</div>
            <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>{isAr?'الوضع الليلي':'Dark Mode'}</div>
                <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{isAr?'تبديل بين الوضع الليلي والنهاري':'Toggle between dark and light theme'}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={toggle}>{theme==='dark'?'☀️ Light':'🌙 Dark'}</button>
            </div>
          </div>

          {profile?.university && (
            <div style={{marginBottom:20,padding:'14px 16px',background:'var(--green-dim)',border:'1px solid var(--green-border)',borderRadius:12}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--success)',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>{isAr?'مؤسستك الحالية':'Your Institution'}</div>
              <div style={{fontSize:14,fontWeight:600}}>{profile.university}</div>
              {profile.faculty    && <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{profile.faculty}</div>}
              {profile.department && <div style={{fontSize:12,color:'var(--text-3)'}}>{profile.department}</div>}
            </div>
          )}

          <button className="btn btn-green btn-full btn-lg" onClick={save} disabled={saving}>
            {saving?'…':saved?(`✓ ${isAr?'تم الحفظ!':'Saved!'}`):tr('saveSettings')}
          </button>

          <div style={{marginTop:20}}>
            <button className="btn btn-danger btn-full" onClick={()=>{logout();navigate('/')}}>
              {tr('signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
