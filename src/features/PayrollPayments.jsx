import PayrollTaxRecords from './PayrollTaxRecords.jsx';
import {useEffect,useState} from 'react';
import {apiRequest} from '../lib/api.js';
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0)/100);
const amount=v=>/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(v)?Math.round(Number(v)*100):null;
const empty=()=>({employeeId:'',payDate:'',method:'check',reference:'',employeeAddress:'',evidenceReference:'',grossReviewReference:'',gross:'',net:'',completed:false,delivery:false});
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const labels={gross_cents:'Gross Wages',projected_net_cents:'Net Paid',total_withholding_cents:'Employee Tax Withholding',
 federal_income_cents:'Federal Income Tax',ohio_income_cents:'Ohio Income Tax',toledo_income_cents:'Toledo Income Tax',school_income_cents:'School District Tax',
 social_security_cents:'Employee Social Security',medicare_cents:'Employee Medicare',additional_medicare_cents:'Additional Medicare',
 voluntary_deductions_cents:'Voluntary Deductions',reimbursement_cents:'Reimbursements',employer_social_security_cents:'Employer Social Security',
 employer_medicare_cents:'Employer Medicare',employer_futa_cents:'Employer FUTA',employer_ohio_ui_cents:'Employer Ohio UI'};
export default function PayrollPayments({businessUnitId}){
 const base='/api/admin/business-units/'+businessUnitId+'/payroll';
 const [taxes,setTaxes]=useState([]),[payments,setPayments]=useState([]),[run,setRun]=useState(''),[detail,setDetail]=useState(null);
 const [form,setForm]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 const [year,setYear]=useState('2026'),[quarter,setQuarter]=useState(''),[report,setReport]=useState(null);
 const [reversal,setReversal]=useState(null),[reason,setReason]=useState(''),[reversalEvidence,setReversalEvidence]=useState(''),[returned,setReturned]=useState(false);
 const [reverseKey,setReverseKey]=useState(()=>crypto.randomUUID());
 async function reload(){const [t,p]=await Promise.all([apiRequest(base+'/tax/calculations'),apiRequest(base+'/payments')]);setTaxes(t.data.filter(x=>x.status==='approved'));setPayments(p.data);}
 useEffect(()=>{let active=true;Promise.all([apiRequest(base+'/tax/calculations'),apiRequest(base+'/payments')]).then(([t,p])=>{if(active){setTaxes(t.data.filter(x=>x.status==='approved'));setPayments(p.data);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[base]);
 useEffect(()=>{let active=true;setDetail(null);setForm(empty());setRequestKey(crypto.randomUUID());if(run)apiRequest(base+'/runs/'+run+'/tax').then(r=>{if(active){setDetail(r.data);setForm({...empty(),payDate:r.data.payDate||''});}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[base,run]);
 const line=detail?.lines.find(x=>x.employeeId===form.employeeId);
 const exists=payments.some(x=>x.runId===run&&x.employeeId===form.employeeId);
 function set(key,value){setForm(f=>({...f,[key]:value}));setRequestKey(crypto.randomUUID());}
 async function act(fn){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function save(e){e.preventDefault();await act(async()=>{
  await apiRequest(base+'/runs/'+run+'/payments',{method:'POST',body:JSON.stringify({requestKey,employeeId:form.employeeId,payDate:form.payDate,
   method:form.method,reference:form.reference,evidenceReference:form.evidenceReference,grossReviewReference:form.grossReviewReference,
   independentlyVerifiedGrossCents:amount(form.gross),netPaidCents:amount(form.net),employeeAddress:form.employeeAddress,
   paymentCompleted:form.completed,statementDelivery:'print_and_deliver'})});
  await reload();setReport(null);setNotice('Payment recorded. Download the statement below, print it, and deliver it to the employee. No bank transfer, Books payment, or tax filing was submitted.');
 });}
 async function statement(id){await act(async()=>{const r=await apiRequest(base+'/payments/'+id+'/statement');download(r.data.html,'text/html;charset=utf-8',r.data.filename);});}
 function exportCsv(){const keys=Object.keys(labels);const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@\-]/,"'$&").replaceAll('"','""')+'"';
  const rows=[['Payment ID','Employee','Pay Date','Status','School District',...keys.map(k=>labels[k]+' (cents)')],
  ...report.payments.map(p=>[p.id,p.statement.employeeName,p.payDate,p.status,p.statement.schoolDistrictCode,...keys.map(k=>p.statement.amounts[k])])];
  download(rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8','paid-payroll-'+year+(quarter?'-Q'+quarter:'')+'.csv');
 }
 return <div className="payroll-payments">
  <h2>Payments & Statements</h2><p>Record completed payments made outside Pioneer. Approved tax previews alone do not mean an employee has been paid.</p>
  <p>Gross wages still require an independent payroll check. Different payment dates or amounts require a reviewed correction. Do not enter bank account numbers or Social Security numbers in references.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form onSubmit={save} className="payment-form">
   <label>Approved Payroll<select aria-label="Approved Payroll" value={run} onChange={e=>setRun(e.target.value)} disabled={busy}><option value="">Select Payroll</option>{taxes.map(t=><option key={t.id} value={t.runId}>{t.periodStart} – {t.periodEnd} · Pay {t.payDate||'date missing'}</option>)}</select></label>
   <label>Employee<select aria-label="Employee" value={form.employeeId} onChange={e=>set('employeeId',e.target.value)} disabled={busy||!detail} required><option value="">Select Employee</option>{detail?.lines.map(l=><option key={l.employeeId} value={l.employeeId}>{l.employeeName}</option>)}</select></label>
   {line&&<p>Approved gross: <strong>{money(line.grossCents)}</strong> · Expected net: <strong>{money(line.projectedNetCents)}</strong></p>}
   {exists&&<p role="status">This employee’s payment is already recorded for this payroll. Reversed records cannot be paid again through this form.</p>}
   <label>Actual Pay Date<input type="date" value={form.payDate} onChange={e=>set('payDate',e.target.value)} required disabled={busy}/></label>
   <label>Payment Method<select value={form.method} onChange={e=>set('method',e.target.value)} disabled={busy}><option value="check">Check</option><option value="bank_transfer">Completed Bank Transfer</option><option value="cash">Cash</option></select></label>
   <label>Unique Payment Reference<input value={form.reference} onChange={e=>set('reference',e.target.value)} minLength={3} maxLength={120} required disabled={busy} placeholder="Check number or transaction reference"/></label>
   <label>Employee Statement Address<textarea value={form.employeeAddress} onChange={e=>set('employeeAddress',e.target.value)} minLength={10} maxLength={500} required disabled={busy} placeholder="Street, city, state, ZIP"/></label>
   <label>Independently Verified Gross ($)<input inputMode="decimal" value={form.gross} onChange={e=>set('gross',e.target.value)} required disabled={busy}/></label>
   <label>Actual Net Paid ($)<input inputMode="decimal" value={form.net} onChange={e=>set('net',e.target.value)} required disabled={busy}/></label>
   <label>Gross Pay Review Reference<textarea value={form.grossReviewReference} onChange={e=>set('grossReviewReference',e.target.value)} minLength={12} maxLength={500} required disabled={busy} placeholder="Independent review of workweek, all hours, rates, overtime, additions and deduction limits"/></label>
   <label>Payment Evidence Reference<textarea value={form.evidenceReference} onChange={e=>set('evidenceReference',e.target.value)} minLength={12} maxLength={500} required disabled={busy} placeholder="Where the completed transfer, issued check, or signed cash receipt is retained"/></label>
   <label><input type="checkbox" checked={form.completed} onChange={e=>set('completed',e.target.checked)} disabled={busy}/> The payment was completed for this employee, amount, and date.</label>
   <label><input type="checkbox" checked={form.delivery} onChange={e=>set('delivery',e.target.checked)} disabled={busy}/> I will print and deliver this statement to the employee on payday.</label>
   <button type="submit" disabled={busy||!line||exists||!form.completed||!form.delivery||amount(form.gross)===null||amount(form.net)===null}>Record Completed Payment</button>
  </form>
  <h2>Payment History</h2>{!payments.length&&<p>No payments have been recorded.</p>}
  {payments.map(p=><article key={p.id} className="payment-record"><h3>{p.statement.employeeName} · {money(p.netPaidCents)}</h3><p>{p.payDate} · {p.method.replaceAll('_',' ')} · {p.reference} · {p.status==='reversed'?'Reversed':'Recorded Paid'}</p>
   <button type="button" disabled={busy} onClick={()=>statement(p.id)}>Download Printable Statement</button>{p.status!=='reversed'&&<button type="button" disabled={busy} onClick={()=>{setReversal(p);setReason('');setReversalEvidence('');setReturned(false);setReverseKey(crypto.randomUUID());}}>Reverse Record</button>}
   {p.status==='reversed'&&<p>{p.reversalReason}</p>}</article>)}
  {reversal&&<form className="payment-form" onSubmit={e=>{e.preventDefault();act(async()=>{await apiRequest(base+'/payments/'+reversal.id+'/reverse',{method:'POST',body:JSON.stringify({requestKey:reverseKey,reason,evidenceReference:reversalEvidence,fullPaymentVoidedOrReturned:returned})});setReversal(null);await reload();setReport(null);setNotice('Reversal recorded. No funds were moved. Reconcile Books and any filed returns separately.');});}}>
   <h3>Reverse {reversal.statement.employeeName} · {money(reversal.netPaidCents)}</h3><p>Use only for a fully voided or returned payment. This keeps the original record and blocks reissue from the same payroll.</p>
   <label>Reason<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={12} required disabled={busy}/></label>
   <label>Void or Return Evidence<textarea value={reversalEvidence} onChange={e=>setReversalEvidence(e.target.value)} minLength={12} required disabled={busy}/></label>
   <label><input type="checkbox" checked={returned} onChange={e=>setReturned(e.target.checked)} disabled={busy}/> The entire payment was voided or returned; I will reconcile related tax records.</label>
   <button disabled={busy||!returned}>Record Reversal</button><button type="button" onClick={()=>setReversal(null)} disabled={busy}>Cancel</button></form>}
  <h2>Paid Payroll Reporting</h2><p>Use this worksheet to prepare and reconcile filings. It covers this business’s recorded payments only, excludes reversed payments from totals, and does not include manually entered prior wages or submit a tax return.</p>
  <form className="payment-form" onSubmit={e=>{e.preventDefault();act(async()=>{const r=await apiRequest(base+'/paid-report?year='+year+(quarter?'&quarter='+quarter:''));setReport(r.data);});}}>
   <label>Tax Year<input type="number" min="2026" max="2100" value={year} onChange={e=>{setYear(e.target.value);setReport(null);}} required/></label>
   <label>Period<select value={quarter} onChange={e=>{setQuarter(e.target.value);setReport(null);}}><option value="">Full Year</option>{[1,2,3,4].map(n=><option key={n} value={n}>Quarter {n}</option>)}</select></label><button disabled={busy}>Build Worksheet</button>
  </form>{report&&<div><p>{report.paymentCount} recorded payments; {report.reversedCount} reversed. {report.scope}</p><table><thead><tr><th>Amount</th><th>Total</th></tr></thead><tbody>{Object.entries(labels).map(([k,v])=><tr key={k}><td>{v}</td><td>{money(report.totals[k])}</td></tr>)}</tbody></table><button type="button" onClick={exportCsv}>Download Payment Worksheet CSV</button><p>Taxes remitted and returns filed must be verified separately. This worksheet is not a Form 941, 940, W-2, or state/local return.</p></div>}
 <PayrollTaxRecords businessUnitId={businessUnitId}/>
 </div>;
}
