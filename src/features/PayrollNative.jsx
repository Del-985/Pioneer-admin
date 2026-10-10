import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../lib/api.js';
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(c)||0)/100);
const hours=s=>(Number(s||0)/3600).toFixed(2);
const todayDetroit=()=>{
 const values=new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=type=>values.find(p=>p.type===type)?.value||'';
 return v('year')+'-'+v('month')+'-'+v('day');
};
const emptyRule=()=>({employeeId:'',deductionCode:'',label:'',amount:'',
 effectiveOn:todayDetroit(),isActive:true,authorizationRecorded:false,authorizationNote:''});
const errorText=e=>e instanceof Error?e.message:'Native payroll request failed.';
function formatMoneyInput(str){
 if(!/^(0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(String(str).trim()))return null;
 const [w,f='']=String(str).trim().split('.');
 const cents=Number(w)*100+Number(f.padEnd(2,'0'));
 return Number.isSafeInteger(cents)&&cents>=0&&cents<=50000000?cents:null;
}
export default function PayrollNative({businessUnitId,employees=[]}){
 const api='/api/admin/business-units/'+businessUnitId+'/payroll';
 const [runs,setRuns]=useState([]);
 const [calculations,setCalculations]=useState([]);
 const [rules,setRules]=useState([]);
 const [runId,setRunId]=useState('');
 const [detail,setDetail]=useState(null);
 const [notes,setNotes]=useState('');
 const [voidReason,setVoidReason]=useState('');
 const [rule,setRule]=useState(emptyRule);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [r,c,d]=await Promise.all([
   apiRequest(api+'/runs'),apiRequest(api+'/native/calculations'),
   apiRequest(api+'/native/deductions')]);
  setRuns(r.data||[]);setCalculations(c.data||[]);setRules(d.data||[]);
  return{runs:r.data||[],calculations:c.data||[]};
 },[api]);
 useEffect(()=>{
  let active=true;
  setRunId('');setRuns([]);setCalculations([]);setRules([]);setDetail(null);
  setLoading(true);setError('');setNotice('');
  load().then(data=>{
   if(active)setRunId(data.runs.find(r=>r.status!=='void')?.id||'');
  }).catch(e=>{if(active)setError(errorText(e));})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[load]);
 const selected=runs.find(r=>r.id===runId);
 const active=calculations.find(c=>c.runId===runId&&c.status!=='void');
 const hasExisting=!!active;
 const eligible=runs.filter(r=>r.status!=='void');
 useEffect(()=>{
  let current=true;setDetail(null);setVoidReason('');
  if(!runId||!active)return;
  apiRequest(api+'/runs/'+runId+'/native')
   .then(r=>{if(current)setDetail(r.data);})
   .catch(e=>{if(current)setError(errorText(e));});
  return()=>{current=false;};
 },[api,runId,active?.id,active?.status]);
 async function transact(label,fn){
  setBusy(label);setError('');setNotice('');
  try{
   await fn();
   const data=await load();
   const updated=data.calculations.find(c=>c.runId===runId&&c.status!=='void');
   if(updated){
    const response=await apiRequest(api+'/runs/'+runId+'/native');
    setDetail(response.data);
   }else setDetail(null);
   setNotice(label+' completed.');
  }catch(e){setError(errorText(e));}
  finally{setBusy('');}
 }
 function prepare(){
  if(!runId)return;
  transact('Native draft prepared',()=>apiRequest(api+'/runs/'+runId+'/native/prepare',{
   method:'POST',body:JSON.stringify({notes:notes.trim()||undefined}),
  }));
 }
 function approve(){
  if(!window.confirm('Approve this NATIVE EARNINGS SNAPSHOT for internal review? This does NOT calculate taxes, finalize net pay, or pay employees.'))return;
  transact('Native calculation approved',()=>apiRequest(api+'/runs/'+runId+'/native/approve',{
   method:'POST',body:JSON.stringify({}),
  }));
 }
 function voidDraft(){
  if(voidReason.trim().length<12){setError('Enter a documented reason of at least 12 characters.');return;}
  if(!window.confirm('Void the native draft? It remains in the audit history. You may prepare a replacement using updated inputs.'))return;
  transact('Native draft voided',()=>apiRequest(api+'/runs/'+runId+'/native/void',{
   method:'POST',body:JSON.stringify({reason:voidReason.trim()}),
  }));
 }
 function saveDeduction(e){
  e.preventDefault();
  const amountCents=formatMoneyInput(rule.amount);
  if(amountCents===null){setError('Enter a nonnegative amount with at most two decimal places.');return;}
  if(rule.isActive&&amountCents>0&&(!rule.authorizationRecorded||rule.authorizationNote.trim().length<12)){
   setError('Record and describe employee authorization before enabling a deduction.');return;
  }
  transact('Deduction rule saved',()=>apiRequest(api+'/native/deductions',{
   method:'POST',body:JSON.stringify({
    employeeId:rule.employeeId,deductionCode:rule.deductionCode.trim().toLowerCase(),
    label:rule.label.trim(),amountCents,effectiveOn:rule.effectiveOn,
    isActive:rule.isActive,authorizationRecorded:rule.authorizationRecorded,
    authorizationNote:rule.authorizationNote.trim(),
   }),
  })).then(()=>setRule(emptyRule()));
 }
 const gross=detail?.grossWagesCents;
 return <section className="native-payroll">
  <header className="section-heading-row">
   <div><h2>Native Payroll Calculation Engine</h2>
    <p className="section-subtitle">Internal Pioneer earnings snapshots from approved timesheets,
      effective-dated rates, and posted adjustments.</p></div>
   <button type="button" className="secondary-button compact-button" disabled={loading||!!busy}
    onClick={()=>transact('Native records refreshed',async()=>{})}>Refresh</button>
  </header>
  <p className="payroll-caution">
   <strong>Calculation preview only.</strong> v0.4.3 does NOT calculate income taxes,
   FICA, final net pay, check amounts, tax remittance, or direct deposits.
   Even approved snapshots cannot authorize payment. Overtime allocation remains an
   estimate, including overnight shifts assigned to their clock-in workweek.
   Management must review employment and overtime compliance before actual payroll.
  </p>
  {error&&<p role="alert" className="form-error section-error">{error}</p>}
  {notice&&<p role="status" className="form-success section-error">{notice}</p>}
  <div className="management-card native-payroll-section">
   <h3>1. Select Payroll Register</h3>
   <label className="field-label">Payroll Source
    <select aria-label="Native payroll source" value={runId} onChange={e=>setRunId(e.target.value)}>
     <option value="">Choose a register</option>
     {eligible.map(r=><option key={r.id} value={r.id}>
       {r.periodStart} – {r.periodEnd} · {money(r.grossCents)} gross · {r.status}
     </option>)}
    </select>
   </label>
   {!eligible.length&&!loading&&<p className="table-secondary">
    First prepare an approved-time gross register under Pay Registers. Native payroll
    does not accept unapproved or unsnapshotted time records.</p>}
   {selected&&<div className="native-payroll-summary">
    <span>Original gross wages <strong>{money(selected.grossCents)}</strong></span>
    <span>Source register <strong>{selected.status}</strong></span>
    <span>Native snapshot <strong>{active?.status||'not prepared'}</strong></span>
   </div>}
   {selected&&!hasExisting&&<>
    <label className="field-label">Calculation Review Notes (Optional)
     <textarea rows={2} maxLength={2000} value={notes}
      onChange={e=>setNotes(e.target.value)}
      placeholder="Any known pay-period issues or calculation notes"/>
    </label>
    <button type="button" className="primary-button" disabled={!!busy||loading}
     onClick={prepare}>Prepare Native Earnings Draft</button>
   </>}
  </div>
  {detail&&<section className="management-card native-payroll-section">
   <h3>2. Review Earnings Breakdown</h3>
   <div className="native-payroll-summary">
    <span>Regular earnings <strong>{money(detail.regularCents)}</strong></span>
    <span>Estimated overtime <strong>{money(detail.overtimeCents)}</strong></span>
    <span>Posted wage adjustments <strong>{money(detail.wageAdjustmentsCents)}</strong></span>
    <span>Gross earnings <strong>{money(gross)}</strong></span>
    <span>Voluntary deduction estimate <strong>{money(detail.voluntaryDeductionsCents)}</strong></span>
    <span>Expense reimbursements <strong>{money(detail.reimbursementCents)}</strong></span>
    <span>Tax withholding <strong>Not calculated</strong></span>
    <span>Net pay <strong>Not calculated</strong></span>
   </div>
   <p className="table-secondary">Gross earnings include posted wage adjustments linked to this
    register or unlinked adjustments dated within its pay period. Reimbursements are
    kept separate from wages and may require tax classification review.
    Voluntary deductions are recorded for calculation review only; the remainder
    before taxes is NOT take-home pay.</p>
   <div className="table-wrap"><table className="feature-table">
    <thead><tr><th>Employee</th><th>Regular Hours</th><th>Estimated OT</th>
      <th>Regular Pay</th><th>OT Pay</th><th>Adjustments</th>
      <th>Gross</th><th>Voluntary Deductions</th><th>Reimbursements</th></tr></thead>
    <tbody>{(detail.lines||[]).map(x=><tr key={x.employeeId}>
     <td><strong>{x.employeeName}</strong></td><td>{hours(x.regularSeconds)}</td>
     <td>{hours(x.overtimeSeconds)}</td><td>{money(x.regularCents)}</td>
     <td>{money(x.overtimeCents)}</td><td>{money(x.adjustmentCents)}</td>
     <td><strong>{money(x.grossCents)}</strong></td>
     <td>{money(x.voluntaryDeductionCents)}</td><td>{money(x.reimbursementCents)}</td>
    </tr>)}</tbody>
   </table></div>
   {(detail.lines||[]).some(x=>x.deductionDetails.length||x.adjustmentDetails.length)&&
    <div className="native-payroll-details">
     <h4>Employee Adjustment &amp; Deduction Details</h4>
     {detail.lines.filter(x=>x.deductionDetails.length||x.adjustmentDetails.length).map(x=>
      <div key={x.employeeId} className="native-payroll-item">
       <strong>{x.employeeName}</strong>
       {x.adjustmentDetails.map(a=><p key={a.adjustmentId}>
         {a.category}: {money(a.amountCents)} — {a.description}</p>)}
       {x.deductionDetails.map(d=><p key={d.ruleId}>
         Voluntary deduction: {d.label} ({d.code}) — {money(d.amountCents)}</p>)}
      </div>)}
    </div>}
   {detail.status==='draft'&&<>
    {selected?.status==='draft'&&<p className="payroll-caution">
      Approve the underlying Pay Register before approving this native calculation.</p>}
    <div className="field-admin-actions">
     <button type="button" className="primary-button" disabled={!!busy||
       selected?.status==='draft'} onClick={approve}>Approve Calculation Snapshot</button>
    </div>
    <label className="field-label">Reason for Voiding Draft
     <textarea rows={2} minLength={12} maxLength={1000}
      value={voidReason} placeholder="Explain what needs to be corrected before recalculation"
      onChange={e=>setVoidReason(e.target.value)}/>
    </label>
    <button type="button" className="secondary-button compact-button"
      disabled={!!busy||voidReason.trim().length<12}
      onClick={voidDraft}>Void Draft &amp; Allow New Calculation</button>
   </>}
   {detail.status==='approved'&&<p className="payroll-caution">
    <strong>Approved internal snapshot — locked.</strong> It remains nonpayable until
    the tax and payment components are implemented and verified.</p>}
   <h4>Calculation Audit</h4>
   {(detail.events||[]).map((event,i)=><p key={i} className="table-secondary">
    {event.action} · {new Date(event.createdAt).toLocaleString()}</p>)}
  </section>}
  <div className="management-card native-payroll-section">
   <h3>3. Authorized Voluntary Deduction Rules</h3>
   <p className="table-secondary">Enter recurring post-tax-type deduction intentions for
    review only, using the amount per pay register. Rules are effective at the
    start of a pay period. Actual tax classification and withholding must be
    reviewed before any payroll payment. Do not put SSNs or bank information here.
    Record consent in the employee’s secure personnel documentation.</p>
   <form onSubmit={saveDeduction}>
    <div className="native-payroll-form">
     <label className="field-label">Employee
      <select required value={rule.employeeId} onChange={e=>setRule(p=>({...p,employeeId:e.target.value}))}>
       <option value="">Select employee</option>
       {employees.map(e=><option key={e.id} value={e.id}>{e.displayName}</option>)}
      </select>
     </label>
     <label className="field-label">Code
      <input required pattern="[a-z][a-z0-9_]{1,39}" maxLength={40}
       placeholder="uniform_deduction" value={rule.deductionCode}
       onChange={e=>setRule(p=>({...p,deductionCode:e.target.value}))}/>
     </label>
     <label className="field-label">Deduction Label
      <input required minLength={3} maxLength={100} placeholder="Voluntary purchase repayment"
       value={rule.label} onChange={e=>setRule(p=>({...p,label:e.target.value}))}/>
     </label>
     <label className="field-label">Amount Per Pay Period ($)
      <input required type="number" min="0" max="500000" step=".01"
       value={rule.amount} onChange={e=>setRule(p=>({...p,amount:e.target.value}))}/>
     </label>
     <label className="field-label">Effective Date
      <input required type="date" value={rule.effectiveOn}
       onChange={e=>setRule(p=>({...p,effectiveOn:e.target.value}))}/>
     </label>
     <label className="native-payroll-checkbox">
      <input type="checkbox" checked={rule.isActive}
       onChange={e=>setRule(p=>({...p,isActive:e.target.checked}))}/>
      Active for future calculations
     </label>
    </div>
    <label className="native-payroll-checkbox">
     <input type="checkbox" checked={rule.authorizationRecorded}
      onChange={e=>setRule(p=>({...p,authorizationRecorded:e.target.checked}))}/>
     I have documented this employee’s authorization for this voluntary deduction.
    </label>
    <label className="field-label">Authorization Note
     <textarea rows={2} maxLength={1000} value={rule.authorizationNote}
      onChange={e=>setRule(p=>({...p,authorizationNote:e.target.value}))}
      placeholder="When and how the employee authorized the deduction (no sensitive identifiers)"/>
    </label>
    <button type="submit" className="primary-button" disabled={!!busy||!rule.employeeId}>
     Save Effective-Dated Deduction Rule</button>
   </form>
   {!!rules.length&&<div className="table-wrap"><table className="feature-table">
    <thead><tr><th>Employee</th><th>Code</th><th>Amount</th><th>Effective</th>
      <th>Status</th><th>Authorization</th></tr></thead>
    <tbody>{rules.map(r=><tr key={r.id}><td>{r.employeeName}</td>
     <td>{r.label} ({r.deductionCode})</td><td>{money(r.amountCents)}</td>
     <td>{r.effectiveOn}</td><td>{r.isActive?'Active':'Inactive'}</td>
     <td>{r.authorizationRecorded?'Documented':'None'}</td></tr>)}</tbody>
   </table></div>}
  </div>
 </section>;
}
