import {useEffect,useState} from 'react';
import {apiRequest} from '../lib/api.js';
const initial=()=>({kind:'filing',authority:'irs',formName:'',periodStart:'',periodEnd:'',completedOn:'',amount:'',confirmationReference:'',evidenceReference:'',notes:'',externallyCompleted:false});
export default function PayrollTaxRecords({businessUnitId}){
 const base='/api/admin/business-units/'+businessUnitId+'/payroll/tax/external-records';
 const [form,setForm]=useState(initial),[records,setRecords]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 useEffect(()=>{let live=true;apiRequest(base).then(r=>{if(live)setRecords(r.data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[base]);
 function set(k,v){setForm(f=>({...f,[k]:v}));setRequestKey(crypto.randomUUID());}
 async function submit(e){e.preventDefault();setError('');setNotice('');setBusy(true);try{
  const {amount,...rest}=form;
  if(amount&&!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amount))throw new Error('Enter a valid dollar amount.');
  await apiRequest(base,{method:'POST',body:JSON.stringify({...rest,requestKey,amountCents:amount?Math.round(Number(amount)*100):null})});
  setRecords((await apiRequest(base)).data);setForm(initial());setRequestKey(crypto.randomUUID());setNotice('External tax activity recorded. Pioneer did not send a return or transfer funds.');
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section><h2>Tax Filings & Remittances</h2><p>After completing a filing or payment through the appropriate agency, retain its confirmation here. These records are an evidence log, not verification of acceptance or a reconciliation of tax balances. Amendments should be entered as separate records referencing the original.</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form className="payment-form" onSubmit={submit}>
 <label>Activity<select aria-label="Activity" value={form.kind} onChange={e=>set('kind',e.target.value)}><option value="filing">Completed Filing</option><option value="remittance">Completed Tax Payment</option></select></label>
 <label>Agency<select value={form.authority} onChange={e=>set('authority',e.target.value)}>{[['irs','IRS'],['ohio','Ohio Withholding'],['school_district','Ohio School District'],['toledo','Toledo'],['odjfs','Ohio Unemployment'],['ssa','Social Security Administration']].map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label>
 <label>Form or Tax Type<input value={form.formName} onChange={e=>set('formName',e.target.value)} required minLength={2} maxLength={120} placeholder="For example, Form 941 or Toledo withholding"/></label>
 {[['periodStart','Period Start'],['periodEnd','Period End'],['completedOn','Completion Date']].map(([k,n])=><label key={k}>{n}<input type="date" value={form[k]} onChange={e=>set(k,e.target.value)} required/></label>)}
 <label>Amount ($){form.kind==='filing'?' — Optional':''}<input inputMode="decimal" value={form.amount} onChange={e=>set('amount',e.target.value)} required={form.kind==='remittance'}/></label>
 <label>Agency Confirmation Reference<input value={form.confirmationReference} onChange={e=>set('confirmationReference',e.target.value)} minLength={3} maxLength={120} required/></label>
 <label>Retained Evidence Reference<textarea value={form.evidenceReference} onChange={e=>set('evidenceReference',e.target.value)} minLength={12} maxLength={500} required/></label>
 <label>Notes<textarea value={form.notes} onChange={e=>set('notes',e.target.value)} maxLength={1000}/></label>
 <label><input type="checkbox" checked={form.externallyCompleted} onChange={e=>set('externallyCompleted',e.target.checked)}/> I completed this activity outside Pioneer and retained the agency confirmation.</label>
 <button disabled={busy||!form.externallyCompleted}>Record External Tax Activity</button></form>
 {records.length===0&&<p>No external tax activity recorded.</p>}{records.map(r=><article className="payment-record" key={r.id}><h3>{r.form_name} · {r.kind==='filing'?'Filing':'Tax Payment'}</h3><p>{r.authority.toUpperCase()} · {r.period_start} through {r.period_end} · Completed {r.completed_on}</p><p>Confirmation: {r.confirmation_reference}{r.amount_cents!==null?' · $'+(Number(r.amount_cents)/100).toFixed(2):''}</p><p>{r.evidence_reference}</p>{r.notes&&<p>{r.notes}</p>}</article>)}
 </section>;
}
