import { useCallback,useEffect,useMemo,useState } from 'react';
import { apiRequest } from '../lib/api.js';

const TZ='America/Detroit';
const statusNames={open:'On Clock',submitted:'Pending Approval',approved:'Approved',returned:'Needs Correction'};
const toTwo=n=>String(n).padStart(2,'0');
function detroitDate(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=x=>parts.find(p=>p.type===x)?.value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
function monday(){
  const d=new Date(detroitDate()+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
function moveWeek(week,days){
  const d=new Date(week+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
function formatTime(value){
  return value?new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short',month:'short',day:'numeric',
    hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)):'Not Recorded';
}
function dateInput(value){
  if(!value)return '';
  const d=new Date(value);
  // The editing control uses the administrator's computer-local time.
  const offset=d.getTimezoneOffset()*60000;
  return new Date(d.getTime()-offset).toISOString().slice(0,16);
}
function duration(sec=0){const minutes=Math.round(sec/60);return Math.floor(minutes/60)+'h '+toTwo(minutes%60)+'m';}
const toIso=v=>v?new Date(v).toISOString():undefined;
const errorText=e=>e instanceof Error?e.message:'Unable to save changes.';
const blankManual={employeeId:'',shiftId:'',workOrderId:'',clockInAt:'',clockOutAt:'',paidBreakMinutes:0,unpaidBreakMinutes:0,reason:''};

function TimeActionForm({entry,mode,onCancel,onSubmit,busy}){
  const isOpen=mode==='close';
  const [start,setStart]=useState(()=>dateInput(entry.clockInAt));
  const [end,setEnd]=useState(()=>dateInput(entry.clockOutAt));
  const [unpaid,setUnpaid]=useState(()=>Math.round(entry.unpaidBreakSeconds/60));
  const [paid,setPaid]=useState(()=>Math.round(entry.paidBreakSeconds/60));
  const [reason,setReason]=useState('');
  const submit=e=>{
    e.preventDefault();
    if(!end||!start)return;
    onSubmit(entry.id,isOpen?'close':'correct',{
      clockInAt:toIso(start),clockOutAt:toIso(end),
      unpaidBreakMinutes:Number(unpaid),paidBreakMinutes:Number(paid),reason:reason.trim()
    });
  };
  return <form className="time-admin-edit" onSubmit={submit}>
    <h4>{isOpen?'Resolve Missed Clock-Out':'Correct Time Entry'}</h4>
    <p className="section-subtitle">Enter times in your device's local time zone. Corrections are audited and require a reason.</p>
    <div className="time-admin-edit-grid">
      <label className="field-label">Clock In
        <input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label className="field-label">Clock Out
        <input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <label className="field-label">Unpaid Break (Minutes)
        <input type="number" min="0" max="2880" required value={unpaid} onChange={e=>setUnpaid(e.target.value)}/></label>
      <label className="field-label">Paid Break (Minutes)
        <input type="number" min="0" max="2880" required value={paid} onChange={e=>setPaid(e.target.value)}/></label>
    </div>
    <label className="field-label">Correction Reason
      <textarea rows={2} required minLength={10} maxLength={2000}
        placeholder="Document why this punch or break needed correction…"
        value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <div className="field-admin-actions">
      <button type="submit" className="primary-button compact-button" disabled={!!busy}>Save Corrected Hours</button>
      <button type="button" className="secondary-button compact-button" onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

export default function TimekeepingAdmin({businessUnitId,employees,shifts=[],jobs=[]}){
  const [week,setWeek]=useState(()=>monday());
  const [entries,setEntries]=useState([]);
  const [summary,setSummary]=useState(null);
  const [employeeSummaries,setEmployeeSummaries]=useState([]);
  const [missed,setMissed]=useState([]);
  const [employeeId,setEmployeeId]=useState('');
  const [status,setStatus]=useState('');
  const [manual,setManual]=useState(blankManual);
  const [showManual,setShowManual]=useState(false);
  const [editing,setEditing]=useState(null);
  const [reviewing,setReviewing]=useState(null);
  const [reviewReason,setReviewReason]=useState('');
  const [history,setHistory]=useState({});
  const [busy,setBusy]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const base='/api/admin/business-units/'+businessUnitId+'/field/time';
  const load=useCallback(async()=>{
    if(!businessUnitId)return;
    setLoading(true);
    try{
      const p=new URLSearchParams({weekStart:week});
      if(employeeId)p.set('employeeId',employeeId);
      if(status)p.set('status',status);
      const result=await apiRequest(base+'?'+p.toString());
      setEntries(result.data?.entries||[]);
      setSummary(result.data?.summary||null);
      setEmployeeSummaries(result.data?.employeeSummaries||[]);
      setMissed(result.data?.missedClockOuts||[]);
      setError('');
    }catch(e){setError(errorText(e));}
    finally{setLoading(false);}
  },[base,businessUnitId,week,employeeId,status]);
  useEffect(()=>{void load();},[load]);

  async function perform(id,endpoint,body,successMessage){
    setBusy(id);setError('');setSuccess('');
    try{
      await apiRequest(base+endpoint,{method:endpoint==='/entries'?'POST':
        endpoint.endsWith('/correct')?'PATCH':endpoint.endsWith('/close')?'POST':
          endpoint.endsWith('/review')?'POST':'POST',
        body:JSON.stringify(body)});
      setEditing(null);setReviewing(null);setReviewReason('');
      setShowManual(false);setManual(blankManual);
      await load();setSuccess(successMessage);
    }catch(e){setError(errorText(e));}
    finally{setBusy('');}
  }
  function editEntry(id,kind,values){
    const endpoint=kind==='close'?'/entries/'+id+'/close':'/entries/'+id;
    setBusy(id);setError('');setSuccess('');
    apiRequest(base+endpoint,{method:kind==='close'?'POST':'PATCH',body:JSON.stringify(values)})
      .then(async()=>{setEditing(null);await load();setSuccess(kind==='close'?
        'Missed clock-out resolved; hours are pending review.':'Time entry corrected and returned to review.');})
      .catch(e=>setError(errorText(e))).finally(()=>setBusy(''));
  }
  async function review(entry,decision){
    if(decision==='return'&&reviewReason.trim().length<10){
      setError('Please provide at least 10 characters explaining what needs correction.');return;
    }
    await perform(entry.id,'/entries/'+entry.id+'/review',
      {decision,reason:reviewReason.trim()||undefined},
      decision==='approve'?'Hours approved.':'Entry returned for correction.');
  }
  async function addManual(e){
    e.preventDefault();
    if(!manual.clockInAt||!manual.clockOutAt)return;
    await perform('manual','/entries',{
      employeeId:manual.employeeId,shiftId:manual.shiftId||null,workOrderId:manual.workOrderId||null,
      clockInAt:toIso(manual.clockInAt),clockOutAt:toIso(manual.clockOutAt),
      paidBreakMinutes:Number(manual.paidBreakMinutes),
      unpaidBreakMinutes:Number(manual.unpaidBreakMinutes),reason:manual.reason.trim(),
    },'Missing shift added for manager review.');
  }
  async function showHistory(id){
    setBusy(id+'history');setError('');
    try{const res=await apiRequest(base+'/entries/'+id+'/history');
      setHistory(prev=>({...prev,[id]:res.data||[]}));}
    catch(e){setError(errorText(e));}finally{setBusy('');}
  }
  const pending=useMemo(()=>entries.filter(e=>e.reviewStatus==='submitted'),[entries]);
  const totalMissed=missed.filter(e=>!employeeId||e.employeeId===employeeId);
  return <section className="time-admin">
    <div className="section-heading-row">
      <div><h2>Timekeeping & Timesheets</h2>
        <p className="section-subtitle">Daily punches, overnight shifts, employee breaks and manager-approved hours. Eastern Time reporting.</p></div>
      <div className="field-admin-actions">
        <button type="button" className="secondary-button compact-button" disabled={loading} onClick={()=>void load()}>
          {loading?'Refreshing…':'Refresh Hours'}</button>
        <button type="button" className="primary-button compact-button" onClick={()=>setShowManual(x=>!x)}>
          {showManual?'Close Manual Entry':'Add Missing Shift'}</button>
      </div>
    </div>
    {error&&<p className="form-error section-error" role="alert">{error}</p>}
    {success&&<p className="form-success section-error" role="status">{success}</p>}
    <div className="time-admin-filters">
      <div className="time-week-controls">
        <button className="secondary-button compact-button" type="button" onClick={()=>setWeek(moveWeek(week,-7))}>Previous Week</button>
        <strong>Week of {new Date(week+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'})}</strong>
        <button className="secondary-button compact-button" type="button" onClick={()=>setWeek(monday())}>This Week</button>
        <button className="secondary-button compact-button" type="button" onClick={()=>setWeek(moveWeek(week,7))}>Next Week</button>
      </div>
      <label className="field-label">Employee
        <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map(e=><option value={e.id} key={e.id}>{e.displayName}</option>)}
        </select></label>
      <label className="field-label">Review Status
        <select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Clocked In</option>
          <option value="submitted">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="returned">Needs Correction</option>
        </select></label>
    </div>
    {showManual&&<form className="management-card time-admin-manual" onSubmit={addManual}>
      <h3>Add a Missing Shift</h3>
      <p className="section-subtitle">Use verified times. Manually entered hours remain pending until approved.</p>
      <div className="time-admin-edit-grid">
        <label className="field-label">Employee
          <select required value={manual.employeeId} onChange={e=>setManual(m=>({...m,employeeId:e.target.value}))}>
            <option value="">Select Employee</option>
            {employees.map(e=><option value={e.id} key={e.id}>{e.displayName}</option>)}
          </select></label>
        <label className="field-label">Accepted Shift (Optional)
          <select value={manual.shiftId} onChange={e=>setManual(m=>({...m,shiftId:e.target.value}))}>
            <option value="">No Linked Shift</option>
            {shifts.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
          </select></label>
        <label className="field-label">Assigned Job (Optional)
          <select value={manual.workOrderId} onChange={e=>setManual(m=>({...m,workOrderId:e.target.value}))}>
            <option value="">No Linked Job</option>
            {jobs.filter(j=>j.status!=='cancelled').map(j=><option key={j.id} value={j.id}>{j.workOrderNumber} — {j.title}</option>)}
          </select></label>
        <label className="field-label">Clock In
          <input type="datetime-local" required value={manual.clockInAt} onChange={e=>setManual(m=>({...m,clockInAt:e.target.value}))}/></label>
        <label className="field-label">Clock Out
          <input type="datetime-local" required value={manual.clockOutAt} onChange={e=>setManual(m=>({...m,clockOutAt:e.target.value}))}/></label>
        <label className="field-label">Unpaid Break (Minutes)
          <input type="number" min="0" max="2880" required value={manual.unpaidBreakMinutes} onChange={e=>setManual(m=>({...m,unpaidBreakMinutes:e.target.value}))}/></label>
        <label className="field-label">Paid Break (Minutes)
          <input type="number" min="0" max="2880" required value={manual.paidBreakMinutes} onChange={e=>setManual(m=>({...m,paidBreakMinutes:e.target.value}))}/></label>
      </div>
      <label className="field-label">Reason for Manual Entry
        <textarea required minLength={10} maxLength={2000} rows={2} value={manual.reason}
          onChange={e=>setManual(m=>({...m,reason:e.target.value}))}/></label>
      <div className="field-admin-actions">
        <button className="primary-button compact-button" type="submit" disabled={!!busy}>Save Missing Shift</button>
        <button className="secondary-button compact-button" type="button" onClick={()=>setShowManual(false)}>Cancel</button>
      </div>
    </form>}
    <div className="time-admin-metrics">
      <div><span>Completed Hours</span><strong>{(summary?.totalHours??0).toFixed(2)}</strong></div>
      <div><span>Approved Hours</span><strong>{(summary?.approvedHours??0).toFixed(2)}</strong></div>
      <div><span>Pending Hours</span><strong>{(summary?.pendingHours??0).toFixed(2)}</strong></div>
      <div><span>Pending Entries</span><strong>{pending.length}</strong></div>
      <div><span>Missed Clock-Outs</span><strong>{totalMissed.length}</strong></div>
    </div>
    {totalMissed.length>0&&<div className="time-missed-alert">
      <strong>Possible Missed Clock-Outs</strong>
      <p>These entries have remained open for over 16 hours. Verify the actual end time before correcting.</p>
      <div className="time-admin-cards">
        {totalMissed.map(entry=><article key={entry.id} className="management-card">
          <strong>{entry.employeeName}</strong>
          <p className="table-secondary">Clocked in {formatTime(entry.clockInAt)}</p>
          <button className="secondary-button compact-button" type="button"
            onClick={()=>setEditing({id:entry.id,mode:'close'})}>Resolve Clock-Out</button>
          {editing?.id===entry.id&&editing.mode==='close'&&
            <TimeActionForm key={entry.id+'close'} entry={entry} mode="close" busy={busy}
              onCancel={()=>setEditing(null)} onSubmit={editEntry}/>}
        </article>)}
      </div>
    </div>}
    {!!employeeSummaries.length&&<section className="time-admin-employee-summaries">
      <h3>Weekly Hours by Employee</h3>
      <div className="table-wrap"><table className="feature-table">
        <thead><tr><th>Employee</th><th>Completed</th><th>Approved</th><th>Pending</th><th>Entries Pending</th></tr></thead>
        <tbody>{employeeSummaries.map(x=><tr key={x.employeeId}>
          <td>{x.employeeName}</td><td>{x.totalHours.toFixed(2)} h</td>
          <td>{x.approvedHours.toFixed(2)} h</td><td>{x.pendingHours.toFixed(2)} h</td>
          <td>{x.pendingCount}</td>
        </tr>)}</tbody></table></div>
    </section>}
    <section className="time-admin-entry-section">
      <h3>Time Entries</h3>
      <div className="time-admin-cards">
        {entries.map(entry=><article className="management-card time-admin-entry" key={entry.id}>
          <div className="field-admin-card-heading">
            <div><strong>{entry.employeeName}</strong>
              <p className="table-secondary">{formatTime(entry.clockInAt)}</p></div>
            <span className={'status-pill '+(entry.reviewStatus==='submitted'?'status-in_progress':'')}>
              {statusNames[entry.reviewStatus]||entry.reviewStatus}</span>
          </div>
          <p className="table-secondary">Out: {formatTime(entry.clockOutAt)}</p>
          {entry.workOrderId&&<p className="table-secondary">Linked Job: {jobs.find(j=>j.id===entry.workOrderId)?.workOrderNumber||entry.workOrderId}</p>}
          {entry.shiftId&&<p className="table-secondary">Linked Shift: {shifts.find(s=>s.id===entry.shiftId)?.title||entry.shiftId}</p>}
          <div className="time-admin-entry-stats">
            <span>Worked: <strong>{duration(entry.workedSeconds)}</strong></span>
            <span>Unpaid Break: <strong>{duration(entry.unpaidBreakSeconds)}</strong></span>
            <span>Paid Break: <strong>{duration(entry.paidBreakSeconds)}</strong></span>
          </div>
          {entry.reviewNotes&&<p className="table-secondary">Review Note: {entry.reviewNotes}</p>}
          {entry.correctionReason&&<p className="table-secondary">Correction: {entry.correctionReason}</p>}
          <div className="field-admin-actions">
            {entry.reviewStatus==='submitted'&&
              <button className="primary-button compact-button" type="button" disabled={!!busy}
                onClick={()=>void review(entry,'approve')}>Approve Hours</button>}
            {entry.reviewStatus==='submitted'&&
              <button className="secondary-button compact-button" type="button" disabled={!!busy}
                onClick={()=>{setReviewing(entry.id);setReviewReason('');}}>Return for Correction</button>}
            <button className="secondary-button compact-button" type="button"
              onClick={()=>setEditing({id:entry.id,mode:entry.isOpen?'close':'correct'})}>
              {entry.isOpen?'Resolve Clock-Out':'Correct Entry'}</button>
            <button className="secondary-button compact-button" type="button"
              onClick={()=>void showHistory(entry.id)}>Audit History</button>
          </div>
          {reviewing===entry.id&&<div className="time-admin-review">
            <label className="field-label">Reason for Returning
              <textarea required minLength={10} maxLength={2000} rows={2}
                value={reviewReason} onChange={e=>setReviewReason(e.target.value)}/></label>
            <div className="field-admin-actions">
              <button className="secondary-button compact-button" type="button" disabled={!!busy}
                onClick={()=>void review(entry,'return')}>Return Entry</button>
              <button className="secondary-button compact-button" type="button" onClick={()=>setReviewing(null)}>Cancel</button>
            </div>
          </div>}
          {editing?.id===entry.id&&<TimeActionForm key={entry.id+editing.mode} entry={entry}
            mode={editing.mode} busy={busy} onCancel={()=>setEditing(null)} onSubmit={editEntry}/>}
          {history[entry.id]&&<div className="time-admin-history">
            <h4>Time Entry Audit</h4>
            {history[entry.id].map((event,index)=><div key={index}>
              <strong>{event.action.replaceAll('_',' ')}</strong>
              <span>{formatTime(event.occurredAt)}</span>
              <pre>{JSON.stringify(event.details,null,2)}</pre>
            </div>)}
          </div>}
        </article>)}
        {!entries.length&&<p className="empty-cell">No employee time entries for this week.</p>}
      </div>
    </section>
    <p className="section-subtitle time-admin-disclaimer">Hours are tracked by the local week in which the shift began. Approval confirms the timesheet only; it does not issue pay or calculate statutory overtime.</p>
  </section>;
}
