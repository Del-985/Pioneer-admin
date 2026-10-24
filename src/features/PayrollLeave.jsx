import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../lib/api.js';

const labels={pending:'Awaiting Approval',approved:'Approved',denied:'Denied',cancelled:'Cancelled'};
const kindLabel=kind=>kind==='sick'?'Sick Leave':'PTO';
const hours=n=>Number(n||0).toFixed(2);
function displayDate(date){
  if(!date)return '—';
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})
    .format(new Date(date+'T12:00:00Z'));
}
export default function PayrollLeave({businessUnitId}){
  const [data,setData]=useState(null),[requests,setRequests]=useState([]);
  const [notes,setNotes]=useState({}),[acting,setActing]=useState(''),[loading,setLoading]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[filter,setFilter]=useState('all');
  const base='/api/admin/business-units/'+businessUnitId+'/payroll/leave';
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [balances,queue]=await Promise.all([apiRequest(base+'/balances'),apiRequest(base+'/requests')]);
      setData(balances.data);setRequests(queue.data||[]);
    }catch(e){setError(e.message||'Unable to load leave requests.');}
    finally{setLoading(false);}
  },[base]);
  useEffect(()=>{setData(null);setRequests([]);setNotes({});setFilter('all');void load();},[load]);

  async function review(id,decision){
    if(decision==='deny'&&(notes[id]||'').trim().length<5){
      setError('Enter at least five characters explaining the denial.');return;
    }
    setActing(id);setError('');setMessage('');
    try{
      await apiRequest(base+'/requests/'+id+'/review',{method:'POST',
        body:JSON.stringify({decision,note:notes[id]||''})});
      setMessage('Leave request '+(decision==='approve'?'approved':decision==='deny'?'denied':'cancelled')+'.');
      setNotes(prev=>({...prev,[id]:''}));
      await load();
    }catch(e){setError(e.message||'Unable to review leave request.');}
    finally{setActing('');}
  }
  const pending=useMemo(()=>requests.filter(r=>r.status==='pending'),[requests]);
  const history=useMemo(()=>requests.filter(r=>r.status!=='pending'&&
    (filter==='all'||r.status===filter||r.leaveType===filter)),[requests,filter]);
  const employees=data?.employees||[];
  const total=(type,key)=>employees.reduce((sum,e)=>sum+Number(e.balances?.[type]?.[key]||0),0);

  function requestCard(r){
    const pendingRequest=r.status==='pending';
    return <article className="leave-admin-request management-card" key={r.id}>
      <div className="leave-admin-request-heading">
        <div><span className="leave-admin-kicker">{kindLabel(r.leaveType)}</span>
          <h4>{r.employeeName||'Employee'}</h4>
          <p>{displayDate(r.startDate)}{r.endDate!==r.startDate?' – '+displayDate(r.endDate):''}</p>
        </div>
        <span className={'leave-admin-status leave-admin-status-'+r.status}>
          {labels[r.status]||r.status}
        </span>
      </div>
      <div className="leave-admin-request-amount"><strong>{hours(r.requestedHours)}</strong><span>Paid hours</span></div>
      {r.note&&<p className="leave-admin-note"><strong>Employee note:</strong> {r.note}</p>}
      {r.managerNote&&<p className="leave-admin-note"><strong>Manager note:</strong> {r.managerNote}</p>}
      {(pendingRequest||r.status==='approved')&&<div className="leave-admin-review">
        <label className="form-field"><span>{pendingRequest?'Manager Note (required for denial)':'Manager Note (optional)'}</span>
          <textarea rows={2} maxLength={1000} value={notes[r.id]||''} placeholder="Optional review details"
            onChange={e=>setNotes(p=>({...p,[r.id]:e.target.value}))}/>
        </label>
        <div className="leave-admin-actions">
          {pendingRequest?<>
            <button className="primary-button compact-button" type="button" disabled={!!acting}
              onClick={()=>void review(r.id,'approve')}>{acting===r.id?'Processing…':'Approve PTO'}</button>
            <button className="secondary-button compact-button" type="button" disabled={!!acting}
              onClick={()=>void review(r.id,'deny')}>Deny Request</button>
          </>:<button className="secondary-button compact-button" type="button" disabled={!!acting}
            onClick={()=>void review(r.id,'cancel')}>Revoke Unpayrolled Leave</button>}
        </div>
      </div>}
    </article>;
  }
  return <section className="payroll-leave">
    <div className="section-heading-row leave-admin-header">
      <div><h2>PTO &amp; Sick Leave</h2>
        <p className="section-subtitle">Track employee leave balances, review planned PTO, and see recorded sick leave.</p>
      </div>
      <button type="button" className="secondary-button compact-button" disabled={loading||!!acting}
        onClick={()=>void load()}>{loading?'Refreshing…':'Refresh Leave'}</button>
    </div>

    {error&&<p className="form-error section-error" role="alert">{error}</p>}
    {message&&<p className="form-success section-error" role="status">{message}</p>}

    <div className="leave-admin-metrics" aria-label="Leave overview">
      <div><span>Available PTO</span><strong>{data?hours(total('pto','balanceHours')):'—'}</strong><small>Hours across employees</small></div>
      <div><span>Available Sick Leave</span><strong>{data?hours(total('sick','balanceHours')):'—'}</strong><small>Hours across employees</small></div>
      <div><span>Awaiting PTO Approval</span><strong>{pending.length}</strong><small>Requests to review</small></div>
    </div>

    <section className="management-card leave-admin-section">
      <div className="section-heading-row"><div><h3>Employee Leave Balances</h3>
        <p className="section-subtitle">Available hours already account for approved usage, reservations, and final payouts.</p>
      </div></div>
      {loading&&!data&&<p className="loading-copy">Loading employee leave balances…</p>}
      {data&&<div className="table-wrap leave-admin-table"><table className="feature-table">
        <thead><tr><th>Employee</th><th>Available PTO</th><th>Pending PTO</th><th>PTO Used</th>
          <th>Available Sick</th><th>Sick Used</th><th>Paid Out</th></tr></thead>
        <tbody>{employees.map(e=><tr key={e.employeeId}>
          <td><strong>{e.employeeName}</strong></td>
          <td>{hours(e.balances.pto.balanceHours)}</td><td>{hours(e.balances.pto.pendingHours)}</td>
          <td>{hours(e.balances.pto.usedHours)}</td>
          <td>{hours(e.balances.sick.balanceHours)}</td><td>{hours(e.balances.sick.usedHours)}</td>
          <td>{hours(Number(e.balances.pto.paidOutHours||0)+Number(e.balances.sick.paidOutHours||0))}</td>
        </tr>)}</tbody>
      </table>{!employees.length&&<p className="leave-admin-empty">No employees were found for this business.</p>}</div>}
    </section>

    <section className="leave-admin-section">
      <div className="section-heading-row"><div><h3>Awaiting Approval <span className="leave-admin-count">{pending.length}</span></h3>
        <p className="section-subtitle">Review scheduled PTO requests. Sick leave is recorded without advance approval.</p>
      </div></div>
      {pending.length===0?<div className="management-card leave-admin-empty">No PTO requests are awaiting approval.</div>:
        <div className="leave-admin-list">{pending.map(requestCard)}</div>}
    </section>

    <section className="leave-admin-section">
      <div className="section-heading-row leave-admin-history-heading">
        <div><h3>Leave History</h3><p className="section-subtitle">Approved, denied, and cancelled requests remain available for review.</p></div>
        <label className="filter-field leave-admin-filter"><span>Show</span>
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All History</option>
            <option value="pto">PTO Only</option>
            <option value="sick">Sick Leave Only</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      {history.length===0?<div className="management-card leave-admin-empty">No leave history matches this filter.</div>:
        <div className="leave-admin-list">{history.map(requestCard)}</div>}
    </section>
    <p className="leave-admin-footnote">Each bank accrues one hour for every 30 worked hours. Both roll over without caps.
      PTO requires 30 days of employment and seven days' advance notice; sick leave has no advance notice requirement.
      Both unused balances are paid out upon separation. Leave hours count toward taxable wages, not overtime or additional accrual.</p>
  </section>;
}
