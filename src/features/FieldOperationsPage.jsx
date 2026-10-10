import { useCallback,useEffect,useState } from 'react';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest, API_BASE_URL } from '../lib/api.js';

const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const nice=(s)=>(s||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const format=(d)=>d?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',
 hour:'numeric',minute:'2-digit'}).format(new Date(d)):'Unscheduled';
const localInput=(d)=>d?new Date(new Date(d).getTime()-new Date(d).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
const iso=(d)=>d?new Date(d).toISOString():null;
const textErr=(error)=>error instanceof Error?error.message:'Request failed.';
const emptyShift={title:'Overnight Snow Removal',startsAt:'',endsAt:'',capacity:1,description:''};
const emptyRoute={id:'',name:'',startsAt:'',notes:'',employeeIds:[],workOrderIds:[]};
function Alert({error,success}){return <>{error&&<p className="form-error section-error" role="alert">{error}</p>}
 {success&&<p className="form-success section-error" role="status">{success}</p>}</>}
const photoUrl=(url)=>url?.startsWith('/')?API_BASE_URL+url:url;
function NoticePhotoList({photos}){return <div className="field-admin-photos">{photos.map(photo=>
 <a key={photo.id} href={photoUrl(photo.downloadUrl)} target="_blank" rel="noopener noreferrer">
   <img src={photoUrl(photo.downloadUrl)} alt={photo.kind+' field photo'}/><span>{nice(photo.kind)}</span>
 </a>)}</div>;}

export function FieldOperationsPage(){
 const {selectedCompany}=useCompany();
 const businessUnitId=selectedCompany?.id;
 const [tab,setTab]=useState('reports');
 const [reports,setReports]=useState([]);
 const [shifts,setShifts]=useState([]);
 const [routes,setRoutes]=useState([]);
 const [availability,setAvailability]=useState([]);
 const [employees,setEmployees]=useState([]);
 const [jobs,setJobs]=useState([]);
 const [photos,setPhotos]=useState({});
 const [reviewNotes,setReviewNotes]=useState({});
 const [shiftForm,setShiftForm]=useState(emptyShift);
 const [shiftOfferIds,setShiftOfferIds]=useState({});
 const [routeForm,setRouteForm]=useState(emptyRoute);
 const [addJob,setAddJob]=useState('');
 const [busy,setBusy]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const base=businessUnitId?`/api/admin/business-units/${businessUnitId}`:'';

 const load=useCallback(async()=>{
  if(!businessUnitId)return;
  setLoading(true);setError('');
  try{
   const [rp,sh,rt,av,st,jb]=await Promise.all([
     apiRequest(base+'/field/reports'),
     apiRequest(base+'/field/shifts'),
     apiRequest(base+'/field/routes'),
     apiRequest(base+'/field/availability'),
     apiRequest(base+'/employees?limit=200&status=active'),
     apiRequest(base+'/work-orders?limit=200')
   ]);
   setReports(Array.isArray(rp.data)?rp.data:[]);
   setShifts(Array.isArray(sh.data)?sh.data:[]);
   setRoutes(Array.isArray(rt.data)?rt.data:[]);
   setAvailability(Array.isArray(av.data)?av.data:[]);
   setEmployees(Array.isArray(st.data)?st.data:[]);
   setJobs(Array.isArray(jb.data)?jb.data:[]);
  }catch(e){setError(textErr(e));}finally{setLoading(false);}
 },[base,businessUnitId]);
 useEffect(()=>{void load();setPhotos({});setRouteForm(emptyRoute);},[load]);

 async function perform(key,request,onSuccess,toast='Changes saved.'){
  setBusy(key);setError('');setSuccess('');
  try{await request();if(onSuccess)onSuccess();await load();setSuccess(toast);}
  catch(e){setError(textErr(e));}finally{setBusy('');}
 }

 async function review(report,decision){
  const notes=reviewNotes[report.id]||'';
  if(decision==='reject'&&!notes.trim()){setError('A rejection explanation is required.');return;}
  await perform(report.id,()=>apiRequest(base+'/field/reports/'+report.id+'/review',{
   method:'POST',body:JSON.stringify({decision,managerNotes:notes.trim()||undefined})}),
   ()=>setReviewNotes(x=>({...x,[report.id]:''})),
   'Report '+(decision==='approve'?'approved.':'returned to employee for correction.'));
 }
 async function viewPhotos(reportId){
  setBusy(reportId+'-photos');setError('');
  try{const response=await apiRequest(base+'/field/reports/'+reportId+'/photos');
   setPhotos(current=>({...current,[reportId]:response.data||[]}));}
  catch(e){setError(textErr(e));}finally{setBusy('');}
 }
 async function createShift(event){
  event.preventDefault();
  if(!shiftForm.startsAt||!shiftForm.endsAt||new Date(shiftForm.endsAt)<=new Date(shiftForm.startsAt)){
    setError('Shift end must follow shift start.');return;
  }
  await perform('shift-new',()=>apiRequest(base+'/field/shifts',{
   method:'POST',body:JSON.stringify({title:shiftForm.title,description:shiftForm.description||null,
     startsAt:iso(shiftForm.startsAt),endsAt:iso(shiftForm.endsAt),capacity:Number(shiftForm.capacity)})}),
   ()=>setShiftForm(emptyShift),'Shift created. Offer it to your employees below.');
 }
 async function offerShift(shift){
  const employeeIds=shiftOfferIds[shift.id]||[];
  if(!employeeIds.length){setError('Select at least one employee to offer the shift.');return;}
  await perform(shift.id,()=>apiRequest(base+'/field/shifts/'+shift.id+'/offers',{
   method:'POST',body:JSON.stringify({employeeIds})}),
   ()=>setShiftOfferIds(x=>({...x,[shift.id]:[]})),'New shift offers queued for email delivery.');
 }
 function toggleOffer(shiftId,id){
   setShiftOfferIds(x=>{
     const current=x[shiftId]||[];
     return{...x,[shiftId]:current.includes(id)?current.filter(v=>v!==id):[...current,id]};
   });
 }
 function toggleCrew(id){
   setRouteForm(x=>({...x,employeeIds:x.employeeIds.includes(id)?
     x.employeeIds.filter(v=>v!==id):[...x.employeeIds,id]}));
 }
 function addStop(){
  if(!addJob)return;
  setRouteForm(x=>({...x,workOrderIds:x.workOrderIds.includes(addJob)?x.workOrderIds:[...x.workOrderIds,addJob]}));
  setAddJob('');
 }
 function moveStop(i,direction){
  const target=i+direction;
  setRouteForm(x=>{
   if(target<0||target>=x.workOrderIds.length)return x;
   const ids=[...x.workOrderIds];[ids[i],ids[target]]=[ids[target],ids[i]];
   return{...x,workOrderIds:ids};
  });
 }
 function editRoute(route){
  setRouteForm({id:route.id,name:route.name,startsAt:localInput(route.startsAt),
    notes:route.notes||'',employeeIds:route.members.map(m=>m.id),
    workOrderIds:route.jobs.map(j=>j.id)});
  setTab('routes');setError('');setSuccess('');
 }
 async function saveRoute(event){
  event.preventDefault();
  await perform('route-save',()=>apiRequest(
    routeForm.id?base+'/field/routes/'+routeForm.id:base+'/field/routes',
    {method:routeForm.id?'PATCH':'POST',
      body:JSON.stringify({name:routeForm.name.trim(),notes:routeForm.notes||null,
        startsAt:iso(routeForm.startsAt),employeeIds:routeForm.employeeIds,
        workOrderIds:routeForm.workOrderIds})}),
    ()=>setRouteForm(emptyRoute),'Crew route saved. Newly assigned crew receive notifications.');
 }
 if(!selectedCompany)return <section className="page-panel">
    <h1>Field Operations</h1><p className="page-description">Select a business to manage field operations.</p>
  </section>;
 return <section className="page-panel field-admin-page">
  <p className="eyebrow">{selectedCompany.name}</p>
  <div className="page-heading-row">
   <div><h1>Field Operations</h1>
     <p className="page-description">Review employee work, schedule shifts, coordinate routes, and track overnight availability.</p></div>
   <button className="secondary-button page-action-button" type="button" disabled={loading} onClick={load}>
     {loading?'Refreshing…':'Refresh'}</button>
  </div>
  <div className="field-admin-tabs" role="tablist" aria-label="Field Operations Sections">
   {[
     ['reports','Completion Reports'],['shifts','Shift Offers'],
     ['routes','Routes & Crews'],['availability','Availability']
   ].map(([value,label])=><button type="button" role="tab" aria-selected={tab===value}
     className={'field-admin-tab '+(tab===value?'active':'')} key={value} onClick={()=>setTab(value)}>{label}</button>)}
  </div>
  <Alert error={error} success={success}/>
  {tab==='reports'&&<section className="data-section">
   <div className="section-heading-row"><div><h2>Employee Completion Reports</h2>
    <p className="section-subtitle">Submitted jobs require your approval. Crew jobs complete when all assigned workers have approved reports.</p></div>
    <span className="record-count">{reports.filter(r=>r.status==='submitted').length} Awaiting Review</span></div>
   <div className="field-admin-report-list">
    {reports.map(report=><article className="management-card" key={report.id}>
      <div className="field-admin-card-heading"><div><strong>{report.workOrderNumber} · {report.jobTitle}</strong>
        <p className="table-secondary">{report.employeeName} · {nice(report.status)} · {format(report.submittedAt||report.startedAt)}</p></div>
        <span className={'status-pill '+(report.status==='submitted'?'status-in_progress':'')}>{nice(report.status)}</span></div>
      {report.completionNotes&&<p><strong>Work Notes:</strong> {report.completionNotes}</p>}
      {report.issueNotes&&<p><strong>Issue:</strong> {report.issueNotes}</p>}
      <p className="table-secondary">Salt Applied: {report.saltApplied?'Yes':'No'} {report.saltAmountLbs!==null?`· ${report.saltAmountLbs} lbs`:''}</p>
      {report.managerNotes&&<p className="table-secondary">Manager Notes: {report.managerNotes}</p>}
      <div className="field-admin-actions">
        <button className="secondary-button compact-button" type="button" onClick={()=>viewPhotos(report.id)} disabled={busy===report.id+'-photos'}>View Photos</button>
      </div>
      {photos[report.id]&&<NoticePhotoList photos={photos[report.id]}/>}
      {report.status==='submitted'&&<div className="field-admin-review">
        <label className="field-label">Manager Review Notes
          <textarea rows={2} maxLength={2000} value={reviewNotes[report.id]||''}
            onChange={e=>setReviewNotes(x=>({...x,[report.id]:e.target.value}))}
            placeholder="Optional approval notes; required for rejection"/></label>
        <div className="field-admin-actions">
          <button className="primary-button compact-button" type="button" disabled={!!busy} onClick={()=>review(report,'approve')}>Approve Work</button>
          <button className="secondary-button compact-button" type="button" disabled={!!busy} onClick={()=>review(report,'reject')}>Request Correction</button>
        </div>
      </div>}
    </article>)}
    {!reports.length&&<p className="empty-cell">No field reports yet. Reports appear when employees acknowledge or start assigned jobs.</p>}
   </div>
  </section>}
  {tab==='shifts'&&<section className="data-section">
    <h2>Create a Shift</h2>
    <form className="management-card employee-form" onSubmit={createShift}>
      <div className="employee-form-grid">
        <label className="field-label">Shift Title<input maxLength={200} required value={shiftForm.title} onChange={e=>setShiftForm(x=>({...x,title:e.target.value}))}/></label>
        <label className="field-label">Positions<input type="number" min={1} max={50} required value={shiftForm.capacity} onChange={e=>setShiftForm(x=>({...x,capacity:Number(e.target.value)}))}/></label>
        <label className="field-label">Starts<input type="datetime-local" required value={shiftForm.startsAt} onChange={e=>setShiftForm(x=>({...x,startsAt:e.target.value}))}/></label>
        <label className="field-label">Ends<input type="datetime-local" required value={shiftForm.endsAt} onChange={e=>setShiftForm(x=>({...x,endsAt:e.target.value}))}/></label>
      </div>
      <label className="field-label">Description<textarea rows={2} maxLength={5000} value={shiftForm.description} onChange={e=>setShiftForm(x=>({...x,description:e.target.value}))}/></label>
      <button className="primary-button" disabled={!!busy} type="submit">Create Shift</button>
    </form>
    <h2>Shift Offers</h2>
    <div className="field-admin-cards">
      {shifts.map(sh=><article className="management-card" key={sh.id}>
        <div className="field-admin-card-heading"><div><strong>{sh.title}</strong>
          <p className="table-secondary">{format(sh.startsAt)} – {format(sh.endsAt)}</p></div>
          <span className="status-pill">{nice(sh.status)}</span></div>
        <p>{sh.description}</p>
        <p className="table-secondary">Accepted: {sh.acceptedCount}/{sh.capacity}</p>
        {!!sh.offers?.length&&<div className="field-offers">{sh.offers.map(ofr=><span key={ofr.id}>{ofr.employeeName}: {nice(ofr.status)}</span>)}</div>}
        {sh.status==='open'&&<div className="field-admin-review">
          <strong className="field-section-label">Offer this shift to:</strong>
          <div className="field-checkbox-grid">{employees.filter(e=>!sh.offers?.some(o=>o.employeeId===e.id)).map(e=><label key={e.id}>
            <input type="checkbox" checked={(shiftOfferIds[sh.id]||[]).includes(e.id)} onChange={()=>toggleOffer(sh.id,e.id)}/> {e.displayName}</label>)}</div>
          <div className="field-admin-actions">
            <button className="primary-button compact-button" type="button" disabled={!!busy} onClick={()=>offerShift(sh)}>Send Offers</button>
            <button className="secondary-button compact-button" type="button" disabled={!!busy} onClick={()=>perform(sh.id,
              ()=>apiRequest(base+'/field/shifts/'+sh.id,{method:'PATCH',body:JSON.stringify({status:'closed'})}),
              null,'Shift closed.')}>Close Shift</button>
            <button className="secondary-button compact-button" type="button" disabled={!!busy} onClick={()=>perform(sh.id,
              ()=>apiRequest(base+'/field/shifts/'+sh.id,{method:'PATCH',body:JSON.stringify({status:'cancelled'})}),
              null,'Shift cancelled.')}>Cancel Shift</button>
          </div>
        </div>}
      </article>)}
      {!shifts.length&&<p className="empty-cell">No shifts created yet.</p>}
    </div>
  </section>}
  {tab==='routes'&&<section className="data-section">
    <h2>{routeForm.id?'Edit Crew Route':'Create a Crew Route'}</h2>
    <form className="management-card employee-form" onSubmit={saveRoute}>
      <div className="employee-form-grid">
        <label className="field-label">Route Name<input required maxLength={200} value={routeForm.name} onChange={e=>setRouteForm(x=>({...x,name:e.target.value}))} placeholder="North Toledo / Overnight"/></label>
        <label className="field-label">Planned Start<input type="datetime-local" value={routeForm.startsAt} onChange={e=>setRouteForm(x=>({...x,startsAt:e.target.value}))}/></label>
      </div>
      <label className="field-label">Crew Members</label>
      <div className="field-checkbox-grid">{employees.map(e=><label key={e.id}>
        <input type="checkbox" checked={routeForm.employeeIds.includes(e.id)} onChange={()=>toggleCrew(e.id)}/> {e.displayName}</label>)}</div>
      <label className="field-label">Add a Job to This Route</label>
      <div className="field-admin-actions">
        <select value={addJob} onChange={e=>setAddJob(e.target.value)}>
          <option value="">Select a job</option>
          {jobs.filter(j=>!routeForm.workOrderIds.includes(j.id)&&j.status!=='cancelled').map(j=>
            <option key={j.id} value={j.id}>{j.workOrderNumber} · {j.title}</option>)}
        </select>
        <button type="button" className="secondary-button compact-button" disabled={!addJob} onClick={addStop}>Add Stop</button>
      </div>
      <div className="field-route-stops">{routeForm.workOrderIds.map((id,i)=>{
        const job=jobs.find(j=>j.id===id);
        return <div key={id} className="field-route-stop">
          <strong>{i+1}. {job?.title||'Unknown Job'}</strong>
          <div className="field-admin-actions">
           <button type="button" className="secondary-button compact-button" disabled={i===0} onClick={()=>moveStop(i,-1)}>↑</button>
           <button type="button" className="secondary-button compact-button" disabled={i===routeForm.workOrderIds.length-1} onClick={()=>moveStop(i,1)}>↓</button>
           <button type="button" className="secondary-button compact-button" onClick={()=>setRouteForm(x=>({...x,workOrderIds:x.workOrderIds.filter(v=>v!==id)}))}>Remove</button>
          </div>
        </div>;
      })}</div>
      <label className="field-label">Route Notes<textarea rows={2} maxLength={3000} value={routeForm.notes} onChange={e=>setRouteForm(x=>({...x,notes:e.target.value}))}/></label>
      <div className="field-admin-actions">
        <button className="primary-button" type="submit" disabled={!!busy}>{routeForm.id?'Save Route':'Create Route'}</button>
        {routeForm.id&&<button type="button" className="secondary-button" onClick={()=>setRouteForm(emptyRoute)}>New Route</button>}
      </div>
    </form>
    <h2>Existing Routes</h2>
    <div className="field-admin-cards">{routes.map(route=><article key={route.id} className="management-card">
      <div className="field-admin-card-heading">
        <div><strong>{route.name}</strong><p className="table-secondary">{format(route.startsAt)}</p></div>
        <span className="status-pill">{nice(route.status)}</span></div>
      <p className="table-secondary">Crew: {route.members.map(m=>m.name).join(', ')||'Unassigned'}</p>
      <p className="table-secondary">Stops: {route.jobs.length}</p>
      <ol className="field-route-list">{route.jobs.map(j=><li key={j.id}>{j.number} · {j.title}</li>)}</ol>
      <div className="field-admin-actions">
        <button type="button" className="secondary-button compact-button" onClick={()=>editRoute(route)}>Edit Route</button>
        {route.status==='planned'&&<button type="button" className="primary-button compact-button" disabled={!!busy}
          onClick={()=>perform(route.id,()=>apiRequest(base+'/field/routes/'+route.id,{
            method:'PATCH',body:JSON.stringify({status:'active'})}),null,'Route activated.')}>Activate</button>}
        {route.status==='active'&&<button type="button" className="primary-button compact-button" disabled={!!busy}
          onClick={()=>perform(route.id,()=>apiRequest(base+'/field/routes/'+route.id,{
            method:'PATCH',body:JSON.stringify({status:'completed'})}),null,'Route marked complete.')}>Finish Route</button>}
      </div>
    </article>)}
    {!routes.length&&<p className="empty-cell">No routes created yet.</p>}
    </div>
  </section>}
  {tab==='availability'&&<section className="data-section">
    <h2>Employee Weekly Availability</h2>
    <p className="section-subtitle">Submitted from the employee portal. Overnight time ranges end on the following day when the end is earlier than the start.</p>
    <div className="table-wrap"><table className="feature-table">
      <thead><tr><th>Employee</th><th>Day</th><th>Start</th><th>End</th><th>Availability</th><th>Notes</th></tr></thead>
      <tbody>{availability.map(slot=><tr key={slot.id}>
        <td>{slot.employeeName}</td><td>{weekdays[slot.weekday]}</td>
        <td>{slot.startTime?.slice(0,5)}</td><td>{slot.endTime?.slice(0,5)}</td>
        <td>{slot.available?'Available':'Unavailable'}</td><td>{slot.notes||'—'}</td>
      </tr>)}
      {!availability.length&&<tr><td colSpan={6} className="empty-cell">No employee availability submitted yet.</td></tr>}</tbody>
    </table></div>
  </section>}
 </section>;
}
