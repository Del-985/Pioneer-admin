import {useCallback,useEffect,useState} from 'react';
import {apiRequest} from '../lib/api.js';

const labels={pending:'Pending',approved:'Approved',denied:'Denied',cancelled:'Cancelled'};
export default function PayrollLeave({businessUnitId}){
  const [data,setData]=useState(null),[requests,setRequests]=useState([]);
  const [notes,setNotes]=useState({}),[acting,setActing]=useState(''),[loading,setLoading]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const base='/api/admin/business-units/'+businessUnitId+'/payroll/leave';
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [balances,queue]=await Promise.all([
        apiRequest(base+'/balances'),apiRequest(base+'/requests')
      ]);
      setData(balances.data);setRequests(queue.data||[]);
    }catch(e){setError(e.message||'Unable to load leave requests.');}
    finally{setLoading(false);}
  },[base]);
  useEffect(()=>{setData(null);setRequests([]);void load();},[load]);
  async function review(id,decision){
    if(decision==='deny'&&!(notes[id]||'').trim()){
      setError('Enter a reason before denying a request.');return;
    }
    setActing(id);setError('');setMessage('');
    try{
      await apiRequest(base+'/requests/'+id+'/review',{method:'POST',
        body:JSON.stringify({decision,note:notes[id]||''})});
      setMessage('Request '+(decision==='approve'?'approved':decision==='deny'?'denied':'cancelled')+'.');
      setNotes(prev=>({...prev,[id]:''}));await load();
    }catch(e){setError(e.message||'Unable to review PTO request.');}
    finally{setActing('');}
  }
  const pending=requests.filter(r=>r.status==='pending');
  const history=requests.filter(r=>r.status!=='pending');
  function item(r){
    return <article className="page-panel" key={r.id} style={{marginBottom:12}}>
      <div className="field-section-heading"><div>
        <h3>{r.employeeName}</h3><p>{r.startDate}{r.endDate!==r.startDate?' – '+r.endDate:''} · {r.requestedHours.toFixed(2)} paid hours</p>
      </div><span className="status-tag">{labels[r.status]||r.status}</span></div>
      {r.note&&<p>Employee note: {r.note}</p>}
      {r.managerNote&&<p>Manager note: {r.managerNote}</p>}
      {(r.status==='pending'||r.status==='approved')&&<div>
        <label className="field"><span>Manager note {r.status==='pending'?'(required for denial)':'(optional)'}</span>
          <textarea rows={2} maxLength={1000} value={notes[r.id]||''}
            onChange={e=>setNotes(p=>({...p,[r.id]:e.target.value}))}/></label>
        {r.status==='pending'?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="button" type="button" disabled={Boolean(acting)} onClick={()=>review(r.id,'approve')}>
            {acting===r.id?'Processing…':'Approve PTO'}</button>
          <button className="button button-outline" type="button" disabled={Boolean(acting)}
            onClick={()=>review(r.id,'deny')}>Deny Request</button>
        </div>:<button className="button button-outline" type="button"
          disabled={Boolean(acting)} onClick={()=>review(r.id,'cancel')}>Revoke Future Approval</button>}
      </div>}
    </article>;
  }
  return <section className="page-panel">
    <div className="field-section-heading"><div><h2>PTO & Sick Leave</h2>
      <p>Each leave bank accrues 1 hour per 30 approved hours worked. Planned PTO requires 7 calendar days' advance notice.</p>
    </div><button className="button button-outline" disabled={loading||Boolean(acting)} onClick={load}>Refresh</button></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {loading&&!data&&<p>Loading PTO balances and requests…</p>}
    {data&&<><h3>Leave Balances</h3>
      <div className="table-wrap"><table><thead><tr>
        <th>Employee</th><th>Available PTO</th><th>Pending PTO</th><th>Used PTO</th><th>Sick Leave</th>
      </tr></thead><tbody>{data.employees.map(e=><tr key={e.employeeId}>
        <td>{e.employeeName}</td>
        <td>{e.balances.pto.balanceHours.toFixed(2)} hrs</td>
        <td>{e.balances.pto.pendingHours.toFixed(2)} hrs</td>
        <td>{e.balances.pto.usedHours.toFixed(2)} hrs</td>
        <td>{e.balances.sick.balanceHours.toFixed(2)} hrs</td>
      </tr>)}</tbody></table></div>
    </>}
    <h3>Awaiting Approval ({pending.length})</h3>
    {pending.length===0&&<p>No pending PTO requests.</p>}
    {pending.map(item)}
    <h3>Request History</h3>
    {history.length===0&&<p>No reviewed requests yet.</p>}
    {history.map(item)}
    <p className="muted">Approving a request immediately reduces available PTO and preserves an audit record. Payroll payment for approved leave remains a separate step.</p>
  </section>;
}
