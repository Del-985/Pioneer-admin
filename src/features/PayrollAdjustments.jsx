import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../lib/api.js';

const usd=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((c||0)/100);
const labels={
  bonus:'Bonus / Additional Compensation',
  retro_pay:'Retroactive Pay',
  wage_correction:'Wage Correction',
  reimbursement:'Employee Expense Reimbursement',
};
const today=()=>{
  const d=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit',
    timeZone:'America/Detroit'}).formatToParts(new Date());
  const p=x=>d.find(y=>y.type===x)?.value;
  return p('year')+'-'+p('month')+'-'+p('day');
};
const blank=()=>({employeeId:'',category:'bonus',amount:'',serviceDate:today(),
  description:'',sourcePayrollRunId:''});
const describeError=e=>e instanceof Error?e.message:'Adjustment request failed.';
function copyAsDownload(text,name){
  const file=new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function csvQuote(value){
  const s=String(value??'');
  const safe=['=','+','-','@'].includes(s.trimStart()[0])?"'"+s:s;
  return '"'+safe.replaceAll('"','""')+'"';
}
export default function PayrollAdjustments({businessUnitId,employees=[],accounts=[],runs=[]}){
  const root='/api/admin/business-units/'+businessUnitId+'/payroll/adjustments';
  const [items,setItems]=useState([]);
  const [form,setForm]=useState(blank);
  const [filter,setFilter]=useState('all');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [review,setReview]=useState(null);
  const [reason,setReason]=useState('');
  const [accountChoices,setAccountChoices]=useState({});
  const [histories,setHistories]=useState({});
  const load=useCallback(async()=>{
    if(!businessUnitId)return;
    try{
      const r=await apiRequest(root);
      setItems(r.data||[]);
    }catch(e){setError(describeError(e));}
  },[root,businessUnitId]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>items.filter(a=>filter==='all'||a.status===filter),[items,filter]);
  const postedRuns=useMemo(()=>runs.filter(r=>r.status==='posted'),[runs]);
  const type=form.category;
  const cashType=type==='reimbursement';
  const defaultAccount=useCallback((kind,name)=>{
    const code=kind==='reimbursement'?(name==='expense'?'6210':'2160'):
      (name==='expense'?'6200':'2150');
    return accounts.find(a=>a.code===code && a.type===(name==='expense'?'expense':'liability'))?.id||'';
  },[accounts]);
  const wageCorrectionNeedsSource=form.category==='wage_correction'||
    Number(form.amount)<0;
  async function work(label,fn,onSuccess){
    setBusy(label);setError('');setSuccess('');
    try{
      const r=await fn();
      if(onSuccess)await onSuccess(r);
      await load();
      setSuccess(label+' completed.');
    }catch(e){setError(describeError(e));}
    finally{setBusy('');}
  }
  async function create(e){
    e.preventDefault();
    const amount=Number(form.amount);
    const cents=Math.round(amount*100);
    if(!Number.isFinite(amount)||!Number.isSafeInteger(cents)||cents===0||
      Math.abs(cents)>50000000){
      setError('Enter an amount between $0.01 and $500,000, optionally negative for wage corrections.');return;
    }
    if((cashType||form.category==='bonus')&&cents<0){
      setError('Bonuses and reimbursements must be positive. Use a wage correction for a reduction.');return;
    }
    if(wageCorrectionNeedsSource&&!form.sourcePayrollRunId){
      setError('Select the original posted payroll run for this correction.');return;
    }
    await work('Adjustment created',()=>apiRequest(root,{
      method:'POST',body:JSON.stringify({
        requestKey:crypto.randomUUID(),employeeId:form.employeeId,category:form.category,
        amountCents:cents,serviceDate:form.serviceDate,
        description:form.description.trim(),sourcePayrollRunId:form.sourcePayrollRunId||null,
      }),
    }),()=>setForm(blank()));
  }
  function checkedConfirm(text){return window.confirm(text);}
  const chosen=(a,kind)=>{
    const key=a.id+'-'+kind;
    return accountChoices[key]??defaultAccount(a.category,kind);
  };
  async function approve(a){
    await work('Adjustment approved',()=>apiRequest(root+'/'+a.id+'/approve',{method:'POST'}));
  }
  async function voidIt(a){
    if(!checkedConfirm('Void this unposted adjustment? It will remain visible in the audit history.'))return;
    await work('Adjustment voided',()=>apiRequest(root+'/'+a.id+'/void',{method:'POST'}));
  }
  async function post(a){
    const expense=chosen(a,'expense'),payable=chosen(a,'payable');
    if(!expense||!payable){setError('Select a valid expense and payable account.');return;}
    if(!checkedConfirm('Post '+usd(a.amountCents)+' '+labels[a.category]+
      ' as an UNPAID accounting adjustment? This will not send wages, reimburse expenses, withhold taxes or move money.'))return;
    await work('Adjustment posted',()=>apiRequest(root+'/'+a.id+'/post',{
      method:'POST',body:JSON.stringify({expenseAccountId:expense,payableAccountId:payable}),
    }));
  }
  async function reverse(a){
    if(reason.trim().length<12){setError('Provide at least 12 characters explaining the reversal.');return;}
    if(!checkedConfirm('Create a new posted reversal journal for '+usd(a.amountCents)+
      '? The original posted entry will stay in the audit trail.'))return;
    await work('Adjustment reversed',()=>apiRequest(root+'/'+a.id+'/reverse',{
      method:'POST',body:JSON.stringify({requestKey:crypto.randomUUID(),reason:reason.trim()}),
    }),()=>{setReview(null);setReason('');});
  }
  async function history(a){
    setBusy('history-'+a.id);setError('');
    try{
      const r=await apiRequest(root+'/'+a.id+'/events');
      setHistories(x=>({...x,[a.id]:r.data||[]}));
    }catch(e){setError(describeError(e));}
    finally{setBusy('');}
  }
  function exportAll(){
    const out=[['Employee','Category','Amount (Dollars)','Service Date','Status','Source Payroll Run',
      'Reverses Adjustment','Posted Journal','Description']];
    for(const a of filtered){
      out.push([a.employeeName,a.category,(a.amountCents/100).toFixed(2),a.serviceDate,
        a.status,a.sourcePayrollRunId||'',a.reversesAdjustmentId||'',a.journalEntryId||'',
        a.description]);
    }
    copyAsDownload(out.map(row=>row.map(csvQuote).join(',')).join('\r\n'),
      'pioneer-payroll-adjustments-'+today()+'.csv');
  }
  return <section className="payroll-adjustments">
    <div className="section-heading-row"><div>
      <h3>Pay Adjustments & Reimbursements</h3>
      <p className="section-subtitle">New audited records—not edits to original payroll or time entries.
        Each posting creates a separate balanced journal in Pioneer Books.</p>
    </div><button className="secondary-button compact-button" type="button" onClick={exportAll}>Export Adjustments CSV</button></div>
    <p className="payroll-caution">
      <strong>Accounting only.</strong> Bonuses and retro-pay adjustments change estimated gross wages.
      Expense reimbursements use separate liability accounts and may have taxable treatment depending on policy.
      None of these entries pays an employee or proves an expense was reimbursed.
    </p>
    {error&&<p role="alert" className="form-error section-error">{error}</p>}
    {success&&<p role="status" className="form-success section-error">{success}</p>}
    <form className="management-card payroll-adjustment-form" onSubmit={create}>
      <h4>Create Payroll Adjustment</h4>
      <div className="payroll-form-grid">
        <label className="field-label">Employee
          <select required value={form.employeeId} onChange={e=>setForm(x=>({...x,employeeId:e.target.value,sourcePayrollRunId:''}))}>
            <option value="">Select Employee</option>
            {employees.filter(e=>e.status!=='terminated').map(e=>
              <option key={e.id} value={e.id}>{e.displayName}</option>)}
          </select></label>
        <label className="field-label">Adjustment Type
          <select value={form.category} onChange={e=>setForm(x=>({...x,category:e.target.value}))}>
            {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
        <label className="field-label">Amount ($) {cashType?'— Expense Reimbursement':'— Gross Wage Adjustment'}
          <input required type="number" min={cashType||type==='bonus'?'0.01':'-500000'}
            max="500000" step=".01" value={form.amount}
            placeholder="50.00" onChange={e=>setForm(x=>({...x,amount:e.target.value}))}/></label>
        <label className="field-label">Work / Expense Date
          <input required type="date" value={form.serviceDate} max={today()}
            onChange={e=>setForm(x=>({...x,serviceDate:e.target.value}))}/></label>
        <label className="field-label">Original Posted Payroll {wageCorrectionNeedsSource?'(Required)':'(Optional)'}
          <select required={wageCorrectionNeedsSource} value={form.sourcePayrollRunId}
            onChange={e=>setForm(x=>({...x,sourcePayrollRunId:e.target.value}))}>
            <option value="">Not linked to a previous payroll run</option>
            {postedRuns.map(r=><option key={r.id} value={r.id}>
              {r.periodStart} – {r.periodEnd} · {usd(r.grossCents)}</option>)}
          </select></label>
      </div>
      <label className="field-label">Reason and Supporting Details
        <textarea required minLength={8} maxLength={2000} rows={3}
          value={form.description} placeholder="Describe why this adjustment is necessary…"
          onChange={e=>setForm(x=>({...x,description:e.target.value}))}/></label>
      <div className="field-admin-actions">
        <button className="primary-button" type="submit" disabled={!!busy||!form.employeeId}>
          Create Draft Adjustment
        </button>
      </div>
      <p className="section-subtitle">Negative amounts are supported for retro-pay or wage corrections tied
        to a previous posted register. Corrections never change its original approved journal.</p>
    </form>
    <div className="payroll-adjustment-filter">
      <h4>Adjustment Register</h4>
      <label className="field-label">Status
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          {['all','draft','approved','posted','void'].map(s=>
            <option value={s} key={s}>{s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select></label>
    </div>
    <div className="payroll-list">{filtered.map(a=><article key={a.id}
      className="management-card payroll-adjustment-entry">
      <div className="payroll-adjustment-header">
        <div><strong>{a.employeeName} · {labels[a.category]}</strong>
          <p className="table-secondary">Date: {a.serviceDate} · {a.status}
            {a.reversesAdjustmentId?' · Reversal':''}
            {a.reversedById?' · Reversed':''}</p></div>
        <strong className="payroll-adjustment-amount">{usd(a.amountCents)}</strong>
      </div>
      <p>{a.description}</p>
      {a.sourcePayrollRunId&&<p className="table-secondary">
        Related posted payroll: {a.sourcePayrollRunId.slice(0,8)}</p>}
      {a.journalEntryId&&<p className="table-secondary">
        Books Journal: {a.journalEntryId}</p>}
      {a.status==='approved'&&<div className="payroll-adjustment-accounts">
        <label className="field-label">Expense Account
          <select value={chosen(a,'expense')} onChange={e=>setAccountChoices(x=>({...x,
            [a.id+'-expense']:e.target.value}))}>
            <option value="">Select expense</option>
            {accounts.filter(x=>x.type==='expense').map(x=>
              <option value={x.id} key={x.id}>{x.code} — {x.name}</option>)}
          </select></label>
        <label className="field-label">Payable Liability Account
          <select value={chosen(a,'payable')} onChange={e=>setAccountChoices(x=>({...x,
            [a.id+'-payable']:e.target.value}))}>
            <option value="">Select liability</option>
            {accounts.filter(x=>x.type==='liability').map(x=>
              <option value={x.id} key={x.id}>{x.code} — {x.name}</option>)}
          </select></label>
      </div>}
      <div className="field-admin-actions">
        {a.status==='draft'&&<button type="button" className="primary-button compact-button"
          disabled={!!busy} onClick={()=>approve(a)}>Approve Adjustment</button>}
        {a.status==='approved'&&<button type="button" className="primary-button compact-button"
          disabled={!!busy} onClick={()=>post(a)}>Post to Pioneer Books</button>}
        {['draft','approved'].includes(a.status)&&<button type="button"
          className="secondary-button compact-button" disabled={!!busy}
          onClick={()=>voidIt(a)}>Void</button>}
        {a.status==='posted'&&!a.reversesAdjustmentId&&!a.reversedById&&
          <button type="button" className="secondary-button compact-button"
            onClick={()=>{setReview(review===a.id?null:a.id);setReason('');}}>
            Reverse Posted Adjustment</button>}
        <button type="button" className="secondary-button compact-button"
          disabled={!!busy} onClick={()=>history(a)}>Audit History</button>
      </div>
      {review===a.id&&<div className="payroll-adjustment-reversal">
        <h4>Reason for Reversal</h4>
        <textarea required minLength={12} maxLength={2000} rows={3}
          value={reason} onChange={e=>setReason(e.target.value)}
          placeholder="Why is this posted adjustment being reversed?"/>
        <div className="field-admin-actions">
          <button type="button" className="primary-button compact-button"
            disabled={!!busy||reason.trim().length<12}
            onClick={()=>reverse(a)}>Create Reversal Journal</button>
          <button type="button" className="secondary-button compact-button"
            onClick={()=>setReview(null)}>Cancel</button>
        </div>
      </div>}
      {histories[a.id]&&<div className="time-admin-history">
        <h4>Adjustment Audit</h4>
        {histories[a.id].map((ev,i)=><div key={i}>
          <strong>{ev.action}</strong>
          <span>{new Date(ev.createdAt).toLocaleString()}</span>
          <pre>{JSON.stringify(ev.detail,null,2)}</pre>
        </div>)}
      </div>}
    </article>)}
    {!filtered.length&&<p className="empty-cell">No payroll adjustments match this filter.</p>}
    </div>
  </section>;
}
