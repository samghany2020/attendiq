import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
const fmtTime=(ts)=>ts?new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'—'
const fmtDate=(d)=>d?new Date(d).toLocaleDateString('en-GB'):''
export function buildReportRows(session,attendance){
  const roster=session?.students||[]
  const attendMap={}
  attendance.forEach(a=>{attendMap[String(a.student_id).toUpperCase()]=a})
  if(roster.length>0) return roster.map(s=>{const rec=attendMap[String(s.id).toUpperCase()]; return {id:s.id,name:s.name||rec?.name||'',group_name:s.group_name||rec?.group_name||'',status:rec?'Present':'Absent',time:rec?fmtTime(rec.checked_in_at):'—',ip:rec?.ip_address||'',external:rec?.is_external_ip||false}})
  return attendance.map(a=>({id:a.student_id,name:a.name||'',group_name:a.group_name||'',status:'Present',time:fmtTime(a.checked_in_at),ip:a.ip_address||'',external:a.is_external_ip||false}))
}
export function exportToExcel(session,attendance){
  const rows=buildReportRows(session,attendance)
  const present=rows.filter(r=>r.status==='Present').length
  const data=[['AttendIQ — Attendance Report'],[],['Session:',session.name],['Subject:',session.subject||'—'],['Date:',fmtDate(session.date)],['Teacher:',session.teacher_name||'—'],['University:',session.university||'—'],[],['Total:',rows.length],['Present:',present],['Absent:',rows.length-present],['Rate:',rows.length>0?`${Math.round((present/rows.length)*100)}%`:'N/A'],[],['#','Student ID','Name','Group','Status','Check-in Time','IP Note'],...rows.map((r,i)=>[i+1,r.id,r.name,r.group_name||'—',r.status,r.time,r.external?'External IP':''])]
  const ws=XLSX.utils.aoa_to_sheet(data); ws['!cols']=[{wch:5},{wch:16},{wch:28},{wch:12},{wch:16}]
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Report'); XLSX.writeFile(wb,`AttendIQ-${session.name}-${fmtDate(session.date)}.xlsx`)
}
export function exportToPDF(session,attendance){
  const rows=buildReportRows(session,attendance)
  const present=rows.filter(r=>r.status==='Present').length
  const rate=rows.length>0?Math.round((present/rows.length)*100):0
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=doc.internal.pageSize.getWidth()
  doc.setFillColor(8,15,11); doc.rect(0,0,W,38,'F')
  doc.setFillColor(26,71,49); doc.roundedRect(12,8,20,20,4,4,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text('IQ',22,21,{align:'center'})
  doc.setTextColor(240,237,230); doc.setFontSize(16); doc.text('AttendIQ',36,16)
  doc.setTextColor(154,170,153); doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.text('Attendance Report',36,23)
  doc.setFontSize(7); doc.setTextColor(74,94,74); doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`,W-12,23,{align:'right'})
  doc.setFillColor(17,31,21); doc.roundedRect(12,44,W-24,28,3,3,'F')
  const info=[['SESSION',session.name],['DATE',fmtDate(session.date)],['SUBJECT',session.subject||'—'],['TEACHER',session.teacher_name||'—']]
  info.forEach(([label,val],i)=>{const x=18+(i%2)*((W-24)/2); const y=i<2?52:63; doc.setTextColor(74,94,74); doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.text(label,x,y); doc.setTextColor(240,237,230); doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.text(String(val).substring(0,30),x,y+5)})
  const stats=[{l:'Total',v:rows.length,c:[100,150,120]},{l:'Present',v:present,c:[58,158,96]},{l:'Absent',v:rows.length-present,c:[224,85,85]},{l:'Rate',v:`${rate}%`,c:[201,151,58]}]
  const sw=(W-28-9)/4
  stats.forEach((s,i)=>{const x=14+i*(sw+3); doc.setFillColor(20,30,22); doc.roundedRect(x,78,sw,18,2,2,'F'); doc.setTextColor(...s.c); doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text(String(s.v),x+sw/2,89,{align:'center'}); doc.setTextColor(74,94,74); doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.text(s.l,x+sw/2,93,{align:'center'})})
  autoTable(doc,{startY:100,head:[['#','Student ID','Name','Status','Time']],body:rows.map((r,i)=>[i+1,r.id,r.name||'—',r.status,r.time]),theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:3,textColor:[180,200,160],fillColor:[15,23,17]},headStyles:{fillColor:[20,30,22],textColor:[74,94,74],fontStyle:'bold',fontSize:7},alternateRowStyles:{fillColor:[17,27,20]},columnStyles:{0:{cellWidth:8,halign:'center'},1:{cellWidth:22},3:{cellWidth:18,halign:'center'},4:{cellWidth:16,halign:'center'}},didParseCell(data){if(data.column.index===3&&data.section==='body')data.cell.styles.textColor=data.cell.raw==='Present'?[58,158,96]:[224,85,85]}})
  doc.save(`AttendIQ-${session.name}-${fmtDate(session.date)}.pdf`)
}