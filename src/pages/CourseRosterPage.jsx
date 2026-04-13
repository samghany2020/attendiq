import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../i18n'

const initials = name => name ? name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?'

export default function CourseRosterPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useAuth()
  const tr = useT(lang)
  const isAr = lang === 'ar'

  const [course,    setCourse]    = useState(null)
  const [students,  setStudents]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [manualId,  setManualId]  = useState('')
  const [manualName,setManualName]= useState('')
  const [manualGrp, setManualGrp] = useState('')
  const [adding,    setAdding]    = useState(false)
  const [search,    setSearch]    = useState('')
  const [filterGrp, setFilterGrp] = useState('all')

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from('courses').select('*').eq('id', id).single(),
        supabase.from('course_students').select('*').eq('course_id', id).order('name'),
      ])
      if (!c) { navigate('/dashboard'); return }
      setCourse(c); setStudents(s || []); setLoading(false)
    }
    load()
  }, [id])

  const groups = [...new Set(students.filter(s => s.group_name).map(s => s.group_name))].sort()

  const handleFile = async file => {
    if (!file) return
    setUploading(true)
    try {
      const buf  = await file.arrayBuffer()
      let rows   = []
      if (file.name.endsWith('.csv')) {
        const lines  = new TextDecoder().decode(buf).trim().split(/\r?\n/).filter(Boolean)
        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["\r]/g, ''))
        const ii = header.findIndex(h => h.includes('id') || h.includes('رقم') || h.includes('number'))
        const ni = header.findIndex(h => h.includes('name') || h.includes('اسم'))
        const gi = header.findIndex(h => h.includes('group') || h.includes('مجموعة') || h.includes('grp'))
        rows = lines.slice(1).map(l => {
          const c = l.split(',').map(x => x.trim().replace(/["\r]/g, ''))
          return { id: c[ii >= 0 ? ii : 0] || '', name: c[ni >= 0 ? ni : 1] || '', group: gi >= 0 ? c[gi] || '' : '' }
        })
      } else {
        const wb   = XLSX.read(buf, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (data.length < 2) { alert('File needs a header row.'); return }
        const header = data[0].map(h => String(h || '').toLowerCase().trim())
        const ii = header.findIndex(h => h.includes('id') || h.includes('رقم') || h.includes('number'))
        const ni = header.findIndex(h => h.includes('name') || h.includes('اسم'))
        const gi = header.findIndex(h => h.includes('group') || h.includes('مجموعة') || h.includes('grp'))
        rows = data.slice(1).filter(r => r.some(Boolean)).map(r => ({
          id:    String(r[ii >= 0 ? ii : 0] || '').trim(),
          name:  String(r[ni >= 0 ? ni : 1] || '').trim(),
          group: gi >= 0 ? String(r[gi] || '').trim() : '',
        }))
      }
      const valid = rows.filter(r => r.id)
      if (!valid.length) { alert(isAr ? 'لم يتم العثور على طلاب.' : 'No students found.'); return }

      // Upsert all students
      const inserts = valid.map(r => ({
        course_id:  id,
        student_id: r.id.toUpperCase(),
        name:       r.name,
        group_name: r.group || null,
      }))
      const { error } = await supabase.from('course_students').upsert(inserts, { onConflict: 'course_id,student_id' })
      if (error) { alert('Error: ' + error.message); return }

      // Reload
      const { data: s } = await supabase.from('course_students').select('*').eq('course_id', id).order('name')
      setStudents(s || [])
      alert(`✅ ${isAr ? 'تم رفع' : 'Uploaded'} ${valid.length} ${isAr ? 'طالب' : 'students'}!`)
    } catch (e) { alert('Error: ' + e.message) }
    finally { setUploading(false) }
  }

  const addStudent = async () => {
    const sid = manualId.trim().toUpperCase()
    if (!sid) return
    setAdding(true)
    const { data, error } = await supabase.from('course_students').upsert({
      course_id: id, student_id: sid,
      name: manualName.trim(), group_name: manualGrp.trim() || null,
    }, { onConflict: 'course_id,student_id' }).select().single()
    if (!error && data) {
      setStudents(prev => {
        const idx = prev.findIndex(s => s.student_id === sid)
        if (idx >= 0) { const n = [...prev]; n[idx] = data; return n }
        return [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      })
      setManualId(''); setManualName(''); setManualGrp('')
    } else alert('Error: ' + error?.message)
    setAdding(false)
  }

  const removeStudent = async sid => {
    await supabase.from('course_students').delete().eq('course_id', id).eq('student_id', sid)
    setStudents(prev => prev.filter(s => s.student_id !== sid))
  }

  const updateGroup = async (sid, grp) => {
    await supabase.from('course_students').update({ group_name: grp || null }).eq('course_id', id).eq('student_id', sid)
    setStudents(prev => prev.map(s => s.student_id === sid ? { ...s, group_name: grp || null } : s))
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Student ID', 'Name', 'Group'],
      ['2023001', 'Ahmad Hassan', 'Group 1'],
      ['2023002', 'Sara Mohammad', 'Group 2'],
      ['2023003', 'Khalid Ibrahim', 'Group 1'],
    ])
    ws['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'course-roster-template.xlsx')
  }

  const filtered = students.filter(s => {
    const ms = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.toLowerCase().includes(search.toLowerCase())
    const mg = filterGrp === 'all' || s.group_name === filterGrp
    return ms && mg
  })

  const groupColors = ['var(--accent)', 'var(--blue, #3a7aaa)', 'var(--success)', '#9b59b6', '#e67e22']

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>

  return (
    <div className="page" dir={isAr ? 'rtl' : 'ltr'}>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points={isAr ? '9 18 15 12 9 6' : '15 18 9 12 15 6'}/>
            </svg>
          </button>
          <div>
            <div className="navbar-title">{isAr && course.name_ar ? course.name_ar : course.name}</div>
            {course.code && <div style={{ fontSize:10, color:'var(--text-3)', marginTop:1 }}>{course.code}</div>}
          </div>
        </div>
        <div className="navbar-right">
          <span className="badge badge-gold">{students.length} {isAr ? 'طالب' : 'students'}</span>
          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
            {isAr ? '⬇ نموذج' : '⬇ Template'}
          </button>
        </div>
      </nav>

      <div className="page-inner">
        {/* Info banner */}
        <div style={{ background:'var(--accent-dim)', border:'1px solid var(--accent-border)', borderRadius:10, padding:'10px 14px', marginTop:14, marginBottom:14, fontSize:12, color:'var(--accent)' }}>
          ✨ {isAr
            ? 'الطلاب المضافون هنا يُضافون تلقائياً لأي جلسة جديدة ترتبط بهذا المقرر — لا حاجة لرفعهم في كل مرة!'
            : 'Students added here are automatically added to any new session linked to this course — no need to re-upload every time!'}
        </div>

        {/* Upload zone */}
        <div className="upload-zone"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]) }}>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFile(e.target.files[0])}/>
          <div className="upload-icon">{uploading ? '⏳' : '📂'}</div>
          <div className="upload-title">{uploading ? (isAr ? 'جاري الرفع…' : 'Uploading…') : (isAr ? 'رفع قائمة الطلاب' : 'Upload Roster File')}</div>
          <div className="upload-hint">{isAr ? 'Excel أو CSV · أعمدة: Student ID، Name، Group' : 'Excel or CSV · columns: Student ID, Name, Group (optional)'}</div>
        </div>

        {/* Group filter */}
        {groups.length > 0 && (
          <div style={{ marginTop:12 }}>
            <div className="tabs">
              <button className={`tab-btn ${filterGrp === 'all' ? 'active' : ''}`} onClick={() => setFilterGrp('all')}>
                {isAr ? 'الكل' : 'All'} <span className="tab-count">{students.length}</span>
              </button>
              {groups.map(g => (
                <button key={g} className={`tab-btn ${filterGrp === g ? 'active' : ''}`} onClick={() => setFilterGrp(g)}>
                  {g} <span className="tab-count">{students.filter(s => s.group_name === g).length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <input className="input" style={{ marginTop:10 }}
          placeholder={isAr ? 'بحث بالاسم أو الرقم…' : 'Search by name or ID…'}
          value={search} onChange={e => setSearch(e.target.value)}/>

        {/* Manual add */}
        <div style={{ marginTop:12 }}>
          <div className="section-title" style={{ marginBottom:7 }}>{isAr ? 'إضافة طالب يدوياً' : 'Add Student Manually'}</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <input className="input" placeholder={isAr ? 'الرقم *' : 'ID *'} value={manualId}
              onChange={e => setManualId(e.target.value)} style={{ flex:'0 0 90px' }}
              onKeyDown={e => e.key === 'Enter' && addStudent()}/>
            <input className="input" placeholder={isAr ? 'الاسم' : 'Full Name'} value={manualName}
              onChange={e => setManualName(e.target.value)} style={{ flex:1, minWidth:120 }}
              onKeyDown={e => e.key === 'Enter' && addStudent()}/>
            <input className="input" placeholder={isAr ? 'المجموعة' : 'Group'} value={manualGrp}
              onChange={e => setManualGrp(e.target.value)} style={{ flex:'0 0 90px' }}
              onKeyDown={e => e.key === 'Enter' && addStudent()}/>
            <button className="btn btn-primary btn-sm" onClick={addStudent} disabled={!manualId.trim() || adding}>
              {adding ? '…' : (isAr ? 'إضافة' : 'Add')}
            </button>
          </div>
        </div>

        {/* Student list */}
        {students.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div className="section-header">
              <span className="section-title">{filtered.length} / {students.length} {isAr ? 'طالب' : 'students'}</span>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }}
                onClick={async () => {
                  if (!confirm(isAr ? 'مسح جميع الطلاب من المقرر؟' : 'Remove all students from this course?')) return
                  await supabase.from('course_students').delete().eq('course_id', id)
                  setStudents([])
                }}>
                {isAr ? 'مسح الكل' : 'Clear all'}
              </button>
            </div>

            {filtered.map((s, i) => {
              const gidx = groups.indexOf(s.group_name)
              const gcol = gidx >= 0 ? groupColors[gidx % groupColors.length] : 'var(--text-3)'
              return (
                <div key={s.student_id} className="roster-item" style={{ animationDelay:`${i*.02}s`, gap:10 }}>
                  <div className="attend-avatar" style={{ width:34, height:34, fontSize:12, background:`${gcol}22`, border:`1.5px solid ${gcol}` }}>
                    {initials(s.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{s.name || '—'}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'monospace' }}>{s.student_id}</div>
                  </div>
                  {/* Group selector */}
                  <select
                    style={{ background:'var(--bg-3)', border:`1px solid ${gcol}`, borderRadius:6, padding:'3px 8px', fontSize:11, color:gcol, fontWeight:600, cursor:'pointer' }}
                    value={s.group_name || ''}
                    onChange={e => updateGroup(s.student_id, e.target.value)}>
                    <option value="">{isAr ? 'بدون مجموعة' : 'No group'}</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    {s.group_name && !groups.includes(s.group_name) && <option value={s.group_name}>{s.group_name}</option>}
                    <option value="Group 1">Group 1</option>
                    <option value="Group 2">Group 2</option>
                    <option value="Group 3">Group 3</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                  <button className="btn btn-ghost btn-icon" onClick={() => removeStudent(s.student_id)} style={{ color:'var(--red)', padding:5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {students.length === 0 && !loading && (
          <div className="empty-state" style={{ marginTop:24 }}>
            <div className="empty-icon">👥</div>
            <div className="empty-title">{isAr ? 'لا يوجد طلاب بعد' : 'No students yet'}</div>
            <div className="empty-text">{isAr ? 'ارفع ملف Excel أو أضف يدوياً' : 'Upload an Excel file or add manually'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
