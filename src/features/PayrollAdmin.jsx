import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../lib/api.js';
import PayrollAdjustments from './PayrollAdjustments.jsx';

const usd=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((c||0)/100);
const hours=s=>(s/3600).toFixed(2);
const dateFromDay=d=>new Date(d+'T12:00:00Z');
function monday(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=type=>p.find(x=>x.type===type)?.value;
  const d=new Date(part('year')+'-'+part('month')+'-'+part('day')+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
function addDays(day,num){
  const date=dateFromDay(day);date.setUTCDate(date.getUTCDate()+num);
  return date.toISOString().slice(0,10);
}
function asText(e){return e instanceof Error?e.message:'Unable to update payroll.';}
function exportCsv(run){
  const quoted=x=>{
    const original=String(x??'');
    const safe=['=','+','-','@'].includes(original.trimStart()[0])?"'"+original:original;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  const lines=[['Employee','Time Entry','Clock-In','Clock-Out','Hourly Rate',
    'Regular Hours','Overtime Hours','Regular Gross','Overtime Gross','Estimated Gross']];
  for(const e of run.lines||[]){
    lines.push([e.employeeName,e.timeEntryId,e.clockInAt,e.clockOutAt,
      (e.hourlyCents/100).toFixed(2),(e.regularSeconds/3600).toFixed(4),
      (e.overtimeSeconds/3600).toFixed(4),(e.regularCents/100).toFixed(2),
      (e.overtimeCents/100).toFixed(2),(e.grossCents/100).toFixed(2)]);
  }
  const csv='\uFEFF'+lines.map(l=>l.map(quoted).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='pioneer-gross-payroll-'+run.periodStart+'-'+run.periodEnd+'.csv';
  a.click();URL.revokeObjectURL(url);
}
export default function PayrollAdmin({businessUnitId,employees=[],section=null}){
  const base='/api/admin/business-units/'+businessUnitId+'/payroll';
  const [rates,setRates]=useState([]);
  const [runs,setRuns]=useState([]);
  const [accounts,setAccounts]=useState([]);
  const [laborCosts,setLaborCosts]=useState([]);
  const [selected,setSelected]=useState(null);
  const [rate,setRate]=useState({employeeId:'',effectiveOn:addDays(monday(),-7),hourly:'',overtimePercent:'150',notes:''});
  const [period,setPeriod]=useState({start:addDays(monday(),-7),weeks:'1',notes:''});
  const [tab,setTab]=useState('runs');
  const activeTab=section||tab;
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState('');
  const [override,setOverride]=useState({expense:'',payable:''});
  const load=useCallback(async()=>{
    if(!businessUnitId)return;
    setLoading(true);
    try{
      const [r,s,a,j]=await Promise.all([
        apiRequest(base+'/rates'),apiRequest(base+'/runs'),apiRequest(base+'/accounts'),
        apiRequest(base+'/labor-costs'),
      ]);
      setRates(r.data||[]);setRuns(s.data||[]);setAccounts(a.data||[]);
      setLaborCosts(j.data||[]);setError('');
    }catch(e){setError(asText(e));}
    finally{setLoading(false);}
  },[base,businessUnitId]);
  useEffect(()=>{void load();setSelected(null);},[load]);

  async function take(action,task,after){
    setBusy(action);setError('');setSuccess('');
    try{const result=await task();if(after)await after(result);
      await load();setSuccess(action+' completed.');}
    catch(e){setError(asText(e));}
    finally{setBusy('');}
  }
  async function inspect(id){
    setBusy('inspect');setError('');
    try{
      const response=await apiRequest(base+'/runs/'+id);
      setSelected(response.data);
      setOverride({expense:response.data.expenseAccountId||'',
        payable:response.data.payableAccountId||''});
    }catch(e){setError(asText(e));}finally{setBusy('');}
  }
  const activeEmployees=employees.filter(e=>e.status!=='terminated');
  const byEmployee=useMemo(()=>{
    const map=new Map();
    for(const r of rates){const list=map.get(r.employeeId)||[];
      list.push(r);map.set(r.employeeId,list);}
    return map;
  },[rates]);
  const end=addDays(period.start,Number(period.weeks)*7);
  const current=monday();
  const ready=selected?.status==='draft';
  const approved=selected?.status==='approved';
  const draftOrApproved=ready||approved;
  return <section className="payroll-admin">
    <header className="section-heading-row">
      <div><h2>Payroll & Pioneer Books</h2>
        <p className="section-subtitle">Calculate gross wages from approved hours, review estimates, and post unpaid wage accruals to Books.</p></div>
      <button type="button" className="secondary-button compact-button" onClick={()=>void load()} disabled={loading||!!busy}>{loading?'Refreshing…':'Refresh'}</button>
    </header>
    <div className="payroll-caution">
      <strong>Gross wage registers only.</strong> Overtime is estimated using a Monday–Sunday Eastern Time clock-in week.
      No tax withholding, net pay, bank transfer or employee payment is calculated or recorded.
      Confirm wage rules and hours before approval and use your payroll provider for actual pay.
    </div>
    {error&&<p role="alert" className="form-error section-error">{error}</p>}
    {success&&<p role="status" className="form-success section-error">{success}</p>}
    {!section&&<div className="field-admin-tabs" role="tablist" aria-label="Payroll Sections">
      <button role="tab" aria-selected={activeTab==='runs'} type="button" className={'field-admin-tab '+(activeTab==='runs'?'active':'')} onClick={()=>setTab('runs')}>Pay Periods & Registers</button>
      <button role="tab" aria-selected={activeTab==='rates'} type="button" className={'field-admin-tab '+(activeTab==='rates'?'active':'')} onClick={()=>setTab('rates')}>Employee Pay Rates</button>
      <button role="tab" aria-selected={activeTab==='accounts'} type="button" className={'field-admin-tab '+(activeTab==='accounts'?'active':'')} onClick={()=>setTab('accounts')}>Books Accounts</button>
      <button role="tab" aria-selected={activeTab==='labor'} type="button" className={'field-admin-tab '+(activeTab==='labor'?'active':'')} onClick={()=>setTab('labor')}>Job Labor Costs</button>
      <button role="tab" aria-selected={activeTab==='adjustments'} type="button" className={'field-admin-tab '+(activeTab==='adjustments'?'active':'')} onClick={()=>setTab('adjustments')}>Adjustments</button>
    </div>}
    {activeTab==='adjustments'&&<PayrollAdjustments businessUnitId={businessUnitId} employees={employees} accounts={accounts} runs={runs}/>}
    {activeTab==='rates'&&<>
      <form className="management-card payroll-rate-form" onSubmit={e=>{
        e.preventDefault();
        const dollars=Number(rate.hourly),percent=Number(rate.overtimePercent);
        if(!Number.isFinite(dollars)||dollars<=0||!Number.isFinite(percent)||percent<100||percent>400){
          setError('Enter a positive hourly rate and overtime factor from 100%–400%.');return;
        }
        take('Rate update',()=>apiRequest(base+'/rates',{method:'POST',
          body:JSON.stringify({employeeId:rate.employeeId,effectiveOn:rate.effectiveOn,
            hourlyCents:Math.round(dollars*100),overtimeMultiplierBps:Math.round(percent*100),
            notes:rate.notes||undefined})}),()=>setRate(r=>({...r,hourly:'',notes:''})));
      }}>
        <h3>Set Effective Hourly Rate</h3>
        <p className="section-subtitle">Rates are restricted personnel information. The overtime factor is a calculation input, not a final legal wage determination.</p>
        <div className="payroll-form-grid">
          <label className="field-label">Employee
            <select required value={rate.employeeId} onChange={e=>setRate(r=>({...r,employeeId:e.target.value}))}>
              <option value="">Select Employee</option>
              {activeEmployees.map(e=><option key={e.id} value={e.id}>{e.displayName}</option>)}
            </select></label>
          <label className="field-label">Effective Date
            <input type="date" required value={rate.effectiveOn} onChange={e=>setRate(r=>({...r,effectiveOn:e.target.value}))}/></label>
          <label className="field-label">Hourly Rate ($)
            <input type="number" min=".01" max="100000" step=".01" required placeholder="18.00"
              value={rate.hourly} onChange={e=>setRate(r=>({...r,hourly:e.target.value}))}/></label>
          <label className="field-label">Overtime Rate (% of Hourly)
            <input type="number" min="100" max="400" step=".01" required
              value={rate.overtimePercent} onChange={e=>setRate(r=>({...r,overtimePercent:e.target.value}))}/></label>
        </div>
        <label className="field-label">Rate Change Notes
          <textarea rows={2} maxLength={1500} value={rate.notes} onChange={e=>setRate(r=>({...r,notes:e.target.value}))}/></label>
        <button type="submit" className="primary-button" disabled={!!busy||!rate.employeeId}>Save Hourly Rate</button>
      </form>
      <div className="payroll-list">
        {activeEmployees.map(e=>{
          const list=byEmployee.get(e.id)||[];
          return <article key={e.id} className="management-card">
            <h3>{e.displayName}</h3>
            {list.length?list.map(r=><p key={r.id} className="payroll-rate-item">
              <strong>{usd(r.hourlyCents)} / hour</strong>
              <span>{r.effectiveOn} · {(r.overtimeMultiplierBps/100).toFixed(2)}% overtime multiplier</span>
            </p>):<p className="table-secondary">No hourly rate is configured.</p>}
          </article>;
        })}
      </div>
    </>}
    {activeTab==='accounts'&&<section className="management-card">
      <h3>Gross Wage Accounting</h3>
      <p className="section-subtitle">Posting debits gross wage expense and credits unpaid gross wages payable. It does not debit checking or record payment.</p>
      <div className="payroll-account-pair">
        <div><strong>Gross Wage Expense</strong>{accounts.filter(a=>a.type==='expense').map(a=>
          <p key={a.id} className={a.suggested?'payroll-recommended':''}>{a.code} — {a.name}</p>)}</div>
        <div><strong>Wages Payable Liability</strong>{accounts.filter(a=>a.type==='liability').map(a=>
          <p key={a.id} className={a.suggested?'payroll-recommended':''}>{a.code} — {a.name}</p>)}</div>
      </div>
      <p className="section-subtitle">Suggested accounts: 6200 Gross Wage Expense and 2150 Gross Wages Payable.
        If your books use different codes, choose the correct accounts when posting an approved register.
      </p>
    </section>}
    {activeTab==='labor'&&<section className="management-card">
      <h3>Recorded Gross Labor by Job</h3>
      <p className="section-subtitle">Includes only hours linked to a work order in posted wage registers. Unassigned or unposted hours are excluded. This is not a complete job-cost or profit report.</p>
      <div className="table-wrap"><table className="feature-table">
        <thead><tr><th>Job</th><th>Employees</th><th>Worked Hours</th><th>Posted Gross Wages</th></tr></thead>
        <tbody>{laborCosts.map(job=><tr key={job.jobId}>
          <td>{job.workOrderNumber} — {job.jobTitle}</td>
          <td>{job.employeeCount}</td>
          <td>{hours(job.workedSeconds)}</td>
          <td>{usd(job.grossLaborCents)}</td>
        </tr>)}
        {!laborCosts.length&&<tr><td colSpan={4} className="empty-cell">No posted time entries are linked to jobs yet.</td></tr>}
        </tbody>
      </table></div>
    </section>}
    {activeTab==='runs'&&<>
      <form className="management-card payroll-period-form" onSubmit={e=>{
        e.preventDefault();
        if(end>current){setError('The payroll period must have ended before preparing a register.');return;}
        take('Payroll draft',()=>apiRequest(base+'/runs',{method:'POST',
          body:JSON.stringify({periodStart:period.start,periodEnd:end,notes:period.notes||undefined})}),
          async response=>{setPeriod(p=>({...p,notes:''}));await inspect(response.data.id);});
      }}>
        <h3>Prepare Gross Payroll Register</h3>
        <p className="section-subtitle">Only approved time is included. Missing pay rates or unapproved punches block preparation.</p>
        <div className="payroll-form-grid">
          <label className="field-label">Period Start (Monday)
            <input type="date" required value={period.start} onChange={e=>setPeriod(p=>({...p,start:e.target.value}))}/></label>
          <label className="field-label">Pay Period
            <select value={period.weeks} onChange={e=>setPeriod(p=>({...p,weeks:e.target.value}))}>
              <option value="1">One Week</option><option value="2">Two Weeks</option>
            </select></label>
          <label className="field-label">Period End (Exclusive)
            <input readOnly value={end} aria-label="Period End"/></label>
        </div>
        <label className="field-label">Payroll Notes
          <textarea rows={2} maxLength={2000} value={period.notes}
            onChange={e=>setPeriod(p=>({...p,notes:e.target.value}))}/></label>
        <button type="submit" className="primary-button" disabled={!!busy}>Prepare Draft Register</button>
      </form>
      <div className="payroll-list">
        <h3>Payroll Registers</h3>
        {runs.map(run=><article key={run.id} className="management-card payroll-run">
          <div><strong>{run.periodStart} – {addDays(run.periodEnd,-1)}</strong>
            <span className={'status-pill '+(run.status==='posted'?'status-completed':'')}>{run.status==='posted'?'Recorded in Books':run.status}</span></div>
          <p className="table-secondary">{usd(run.grossCents)} estimated gross · {hours(run.regularSeconds)} regular hours · {hours(run.overtimeSeconds)} overtime hours</p>
          <div className="field-admin-actions">
            <button className="secondary-button compact-button" type="button" disabled={!!busy}
              onClick={()=>inspect(run.id)}>Review Register</button>
            {run.journalEntryId&&<span className="table-secondary">Books Journal: {run.journalEntryId.slice(0,8)}</span>}
          </div>
        </article>)}
        {!runs.length&&<p className="empty-cell">No payroll registers yet. Approve employee hours, configure rates, and prepare a period.</p>}
      </div>
      {selected&&<section className="management-card payroll-detail">
        <div className="payroll-detail-heading">
          <div><h3>Gross Payroll Review</h3>
            <p className="section-subtitle">{selected.periodStart} – {addDays(selected.periodEnd,-1)} · {selected.status}</p></div>
          <button type="button" className="secondary-button compact-button" onClick={()=>setSelected(null)}>Close</button>
        </div>
        <div className="payroll-totals">
          <div><span>Regular Hours</span><strong>{hours(selected.regularSeconds)}</strong></div>
          <div><span>Overtime Hours</span><strong>{hours(selected.overtimeSeconds)}</strong></div>
          <div><span>Estimated Gross Wages</span><strong>{usd(selected.grossCents)}</strong></div>
        </div>
        <h4>Employee Gross Totals</h4>
        <div className="table-wrap"><table className="feature-table">
          <thead><tr><th>Employee</th><th>Regular</th><th>Estimated Overtime</th><th>Gross</th></tr></thead>
          <tbody>{(selected.employees||[]).map(e=><tr key={e.employeeId}>
            <td>{e.employeeName}</td><td>{hours(e.regularSeconds)}h</td>
            <td>{hours(e.overtimeSeconds)}h</td><td>{usd(e.grossCents)}</td>
          </tr>)}</tbody>
        </table></div>
        <h4>Source Time Entries</h4>
        <div className="table-wrap"><table className="feature-table">
          <thead><tr><th>Employee</th><th>Clock-In</th><th>Hourly</th><th>Regular</th><th>OT</th><th>Gross</th></tr></thead>
          <tbody>{(selected.lines||[]).map(line=><tr key={line.id}>
            <td>{line.employeeName}</td><td>{new Date(line.clockInAt).toLocaleString()}</td>
            <td>{usd(line.hourlyCents)}</td><td>{hours(line.regularSeconds)}h</td>
            <td>{hours(line.overtimeSeconds)}h</td><td>{usd(line.grossCents)}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="payroll-account-pair payroll-booking-choice">
          <label className="field-label">Wages Expense Account
            <select value={override.expense} disabled={!approved} onChange={e=>setOverride(x=>({...x,expense:e.target.value}))}>
              {accounts.filter(x=>x.type==='expense').map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
            </select></label>
          <label className="field-label">Gross Wages Payable
            <select value={override.payable} disabled={!approved} onChange={e=>setOverride(x=>({...x,payable:e.target.value}))}>
              {accounts.filter(x=>x.type==='liability').map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
            </select></label>
        </div>
        <div className="field-admin-actions payroll-approval-actions">
          <button type="button" className="secondary-button compact-button" onClick={()=>exportCsv(selected)}>Export Gross Payroll CSV</button>
          {ready&&<button className="primary-button compact-button" disabled={!!busy} type="button"
            onClick={()=>{
              if(!window.confirm('Approve these estimated gross wages? This locks the register until it is voided or posted.'))return;
              take('Payroll approval',()=>apiRequest(base+'/runs/'+selected.id+'/approve',{method:'POST'}),
                ()=>inspect(selected.id));
            }}>Approve Register</button>}
          {draftOrApproved&&<button className="secondary-button compact-button" disabled={!!busy} type="button"
            onClick={()=>{
              if(!window.confirm('Void this unposted payroll register? Its time entries will be released for corrections.'))return;
              take('Void payroll',()=>apiRequest(base+'/runs/'+selected.id+'/void',{method:'POST'}),()=>setSelected(null));
            }}>Void Unposted Register</button>}
          {approved&&<button className="primary-button compact-button" disabled={!!busy} type="button"
            onClick={()=>{
              if(!override.expense||!override.payable){setError('Select both Books accounts.');return;}
              if(!window.confirm('POST UNPAID GROSS WAGES TO PIONEER BOOKS? This creates a balanced journal but DOES NOT pay the employee, withhold taxes or send any transfer.'))return;
              take('Books payroll posting',()=>apiRequest(base+'/runs/'+selected.id+'/post',{
                method:'POST',body:JSON.stringify({
                  expenseAccountId:override.expense,payableAccountId:override.payable,
                })
              }),()=>inspect(selected.id));
            }}>Post Unpaid Wages to Books</button>}
        </div>
        {selected.status==='posted'&&<p className="payroll-caution">
          Wages were accrued in Pioneer Books under journal {selected.journalEntryId}.
          No payment, bank withdrawal, tax calculation, or employee net pay has been recorded.
        </p>}
      </section>}
    </>}
  </section>;
}
