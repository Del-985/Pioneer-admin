import {useEffect,useState} from 'react';
import {apiRequest,API_BASE_URL} from '../lib/api.js';
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0)/100);
const initial=()=>({year:2026,quarter:4,ein:'',street:'',city:'',state:'OH',zip:'',signerName:'',signerTitle:'',phone:'',depositSchedule:'monthly',priorQuarterTaxCents:0,
 federalDepositIds:[],priorCreditCents:0,creditEvidence:'',censusEmployees:0,seasonalEmployer:false,ohioAccount:'',toledoAccount:'',
 allWagesIncluded:false,ordinaryPayrollOnly:false,form941Required:false,originalReturn:false,depositsReconciled:false,censusVerified:false,applyOverpaymentToNextReturn:false,reviewReference:''});
function saveFile(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const checks={allWagesIncluded:'All wages paid by this legal employer during the quarter, including every business unit and any outside payroll, are recorded in Pioneer.',
 ordinaryPayrollOnly:'This is ordinary cash payroll: no tips, taxable benefits, third-party sick pay, special FICA exemptions, research credits, 3121(q) notices, or final-business return.',
 form941Required:'I verified that this employer files Form 941, not Form 944 or another employment tax return, and verified the deposit schedule.',
 originalReturn:'This is an original return for this quarter, not a correction or amendment.',
 depositsReconciled:'I reconciled the selected IRS deposits and any prior-return credit to agency records; these amounts are assigned to this quarter.',
 censusVerified:'I verified the employee count for the pay period including the 12th of the final month of this quarter.',
 applyOverpaymentToNextReturn:'If the return shows an overpayment, apply it to the next return. No refund bank details will be included.'};
export default function PayrollFilings({businessUnitId}){
 const base='/api/admin/business-units/'+businessUnitId+'/payroll/filings';
 const [form,setForm]=useState(initial),[context,setContext]=useState(null),[packets,setPackets]=useState([]),[detail,setDetail]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false);
 const [credit,setCredit]=useState('0.00'),[priorTax,setPriorTax]=useState('');
 useEffect(()=>{let live=true;setContext(null);setError('');Promise.all([apiRequest(base+'/context?quarter='+form.quarter),apiRequest(base)]).then(([c,p])=>{if(live){setContext(c.data);setPackets(p.data);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[base,form.quarter]);
 function set(k,v){setForm(f=>({...f,[k]:v}));}
 async function act(fn){setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function open(id){setReviewed(false);setDetail((await apiRequest(base+'/'+id)).data);}
 async function prepare(e){e.preventDefault();await act(async()=>{
  if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(credit))throw new Error('Enter prior credit in dollars and cents.');
  if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(priorTax))throw new Error('Enter verified prior-quarter tax in dollars and cents.');
  const r=await apiRequest(base,{method:'POST',body:JSON.stringify({...form,priorQuarterTaxCents:Math.round(Number(priorTax)*100),priorCreditCents:Math.round(Number(credit)*100)})});
  setPackets((await apiRequest(base)).data);await open(r.data.id);
 });}
 async function pdf(){await act(async()=>{
  const r=await fetch(API_BASE_URL+base+'/'+detail.id+'/form-941',{credentials:'include'});
  if(!r.ok){const e=await r.json();throw new Error(e.error?.message||'Return download failed.');}
  saveFile(await r.arrayBuffer(),'application/pdf','Form-941-2026-Q'+detail.quarter+'-unsigned.pdf');
 });}
 async function worksheet(){await act(async()=>{
  const d=(await apiRequest(base+'/'+detail.id)).data;setDetail(d);
  if(d.stale)throw new Error('Payroll or deposits changed. Prepare a new packet before exporting.');
  const esc=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const rows=[...(import.meta.env.VITE_APP_ENV==='sandbox'?[['TEST ONLY - DO NOT FILE - FICTIONAL DATA']]:[]),['Pioneer filing preparation','2026 Q'+d.quarter,d.status,'Not an agency return; verify required filing frequency'],['Employer',d.employerName],['Ohio Account',d.inputs.ohioAccount],['Toledo Account',d.inputs.toledoAccount],[],
   ['Form 941 line','Cents'],...Object.entries(d.figures.lines),[],['Month','Federal liability cents','Ohio withheld cents','Toledo withheld cents','School district','District withheld cents']];
  for(const m of d.figures.monthly){rows.push([m.month,m.federalLiability,m.ohio,m.toledo,'','']);for(const [code,value] of Object.entries(m.districts))rows.push([m.month,'','','',code,value]);}
  rows.push([],['Payday','Ohio withheld cents','Toledo withheld cents','School district','District withheld cents']);
  for(const [day,w] of Object.entries(d.figures.withholdingByPayday)){rows.push([day,w.ohio,w.toledo,'','']);for(const [code,value] of Object.entries(w.districts))rows.push([day,'','',code,value]);}
  rows.push([],['Reported Agency Activity','Type','Form / Tax','Period Start','Period End','Completion','Amount cents','Confirmation']);
  for(const r of d.externalRecords)rows.push([r.authority,r.kind,r.form_name,r.period_start,r.period_end,r.completed_on,r.amount_cents,r.confirmation_reference]);
  rows.push([],['Limitations',d.annualNote],['State/local use',d.stateLocalNote],...d.blockers.map(x=>['BLOCKED',x]));
  saveFile(rows.map(r=>r.map(esc).join(',')).join('\r\n'),'text/csv;charset=utf-8','Payroll-Filing-Preparation-2026-Q'+d.quarter+'.csv');
 });}
 return <div className="payroll-filings"><h2>Tax Return Preparation</h2><p>Prepare an unsigned federal Form 941 and state/local withholding schedules for your own submission. This combines all businesses under the selected legal employer. Access requires legal-entity or platform administration.</p>
 <p>Supported: 2026 quarters 3 and 4, ordinary payroll, original Form 941, monthly federal depositors. Ohio and Toledo exports are preparation worksheets for entry into agency systems. Annual returns, W-2s and Schedule B are not generated here.</p>
 {error&&<p role="alert" className="form-error">{error}</p>}
 {context&&<><p><strong>{context.employerName}</strong> · {context.units.map(u=>u.name).join(', ')} · {context.paymentCount} recorded payments in this quarter.</p>
 <form onSubmit={prepare} className="payment-form">
 <label>Quarter<select aria-label="Filing Quarter" value={form.quarter} disabled={busy} onChange={e=>{set('quarter',Number(e.target.value));set('federalDepositIds',[]);}}><option value={3}>2026 Q3 · July–September</option><option value={4}>2026 Q4 · October–December</option></select></label>
 {[['ein','Employer EIN'],['street','Employer Street Address'],['city','Employer City'],['zip','Employer ZIP'],['signerName','Authorized Signer Name'],['signerTitle','Signer Title'],['phone','Daytime Phone']].map(([k,label])=><label key={k}>{label}<input value={form[k]} onChange={e=>set(k,e.target.value)} required disabled={busy} autoComplete="off" maxLength={k==='street'?55:35}/></label>)}
 <p>Employer state: Ohio. The signer’s name is printed; the return remains unsigned.</p>
 <label>Federal Deposit Schedule<select aria-label="Federal Deposit Schedule" value={form.depositSchedule} onChange={e=>set('depositSchedule',e.target.value)} disabled={busy}><option value="monthly">Verified Monthly Depositor</option><option value="semiweekly">Semiweekly · Schedule B Required</option></select></label>
 <label>Prior Quarter Form 941 Line 12 ($)<input value={priorTax} onChange={e=>setPriorTax(e.target.value)} inputMode="decimal" required disabled={busy}/></label><p>Verify against the previous return; enter zero if this is the employer’s first quarter. This determines the small-liability exception on line 16.</p>
 <label>Employees in Reference Pay Period<input aria-label="Employees in Reference Pay Period" type="number" min="0" max="100000" required value={form.censusEmployees} onChange={e=>set('censusEmployees',Number(e.target.value))} disabled={busy}/></label>
 <p>Use the pay period including {form.quarter===3?'September 12':'December 12'}, not the total number of people paid during the quarter.</p>
 <fieldset disabled={busy}><legend>IRS Deposits Applied to This Quarter</legend>{!context.deposits.length&&<p>No overlapping IRS remittances recorded. Record completed deposits under Payments & Statements first. Select none only if verified zero deposits.</p>}
 {context.deposits.map(d=><label key={d.id}><input type="checkbox" checked={form.federalDepositIds.includes(d.id)} onChange={e=>set('federalDepositIds',e.target.checked?[...form.federalDepositIds,d.id]:form.federalDepositIds.filter(id=>id!==d.id))}/>{d.form_name} · {d.period_start}–{d.period_end} · {money(d.amount_cents)} · {d.confirmation_reference}</label>)}</fieldset>
 <label>Verified Prior-Return Credit ($)<input inputMode="decimal" value={credit} onChange={e=>setCredit(e.target.value)} disabled={busy}/></label>
 <label>Prior-Credit Evidence Reference<textarea value={form.creditEvidence} onChange={e=>set('creditEvidence',e.target.value)} disabled={busy} maxLength={500}/></label>
 <label>Ohio Withholding Account<input value={form.ohioAccount} onChange={e=>set('ohioAccount',e.target.value)} disabled={busy} maxLength={40}/></label>
 <label>Toledo Withholding Account<input value={form.toledoAccount} onChange={e=>set('toledoAccount',e.target.value)} disabled={busy} maxLength={40}/></label>
 <label><input type="checkbox" checked={form.seasonalEmployer} onChange={e=>set('seasonalEmployer',e.target.checked)} disabled={busy}/> Claim seasonal-employer treatment on Form 941 line 18 (verify eligibility).</label>
 {Object.entries(checks).map(([k,label])=><label key={k}><input type="checkbox" checked={form[k]} onChange={e=>set(k,e.target.checked)} disabled={busy}/>{label}</label>)}
 <label>Reconciliation Evidence Reference<textarea value={form.reviewReference} onChange={e=>set('reviewReference',e.target.value)} minLength={12} maxLength={500} required disabled={busy}/></label>
 <button disabled={busy||Object.keys(checks).some(k=>!form[k])}>Prepare Filing Packet</button></form></>}
 <h3>Saved Packets</h3>{packets.map(p=><p key={p.id}><button disabled={busy} onClick={()=>act(()=>open(p.id))}>2026 Q{p.quarter} · {p.reviewed_at?'Reviewed':'Draft'} · {new Date(p.created_at).toLocaleString()}</button></p>)}
 {detail&&<section className="payment-record"><h3>{detail.employerName} · 2026 Q{detail.quarter}</h3><p>Status: {detail.stale?'Stale — prepare a new packet':detail.status}. This is not a filed return.</p>
 {!detail.periodClosed&&<p role="status">The quarter is still open. This is a planning draft; final review and official return download stay disabled until the quarter ends.</p>}
 {detail.blockers.map((b,i)=><p key={i} role="alert">{b}</p>)}
 {detail.censusDifference&&<p>The entered employee count differs from the reference-period count found in recorded payments ({detail.figures.census}). Verify the entered count before signing.</p>}
 <table><thead><tr><th>Federal Form 941</th><th>Amount</th></tr></thead><tbody>{[['line2','Wages'],['line3','Federal Withholding'],['line5e','Social Security & Medicare'],['line7','Employee Rounding Adjustment'],['line12','Total Tax'],['line13','Deposits & Credits'],['line14','Balance Due'],['line15','Overpayment to Next Return']].map(([k,label])=><tr key={k}><td>{label}</td><td>{money(detail.figures.lines[k])}</td></tr>)}</tbody></table>
 <h4>Monthly Withholding Schedules</h4><table><thead><tr><th>Month</th><th>Federal Liability</th><th>Ohio</th><th>Toledo</th><th>School Districts</th></tr></thead><tbody>{detail.figures.monthly.map(m=><tr key={m.month}><td>{m.month}</td><td>{money(m.federalLiability)}</td><td>{money(m.ohio)}</td><td>{money(m.toledo)}</td><td>{Object.entries(m.districts).map(([c,v])=>c+': '+money(v)).join(', ')||'None'}</td></tr>)}</tbody></table>
 <p>{detail.stateLocalNote}</p><p>{detail.annualNote}</p>
 <button disabled={busy||detail.stale} onClick={worksheet}>Download Preparation Worksheet</button>
 <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I reviewed this complete packet against payroll and agency records.</label>
 <button disabled={busy||!reviewed||detail.stale||!detail.periodClosed||detail.blockers.length>0||detail.status==='reviewed'} onClick={()=>act(async()=>{await apiRequest(base+'/'+detail.id+'/review',{method:'POST',body:JSON.stringify({reviewed:true})});await open(detail.id);setPackets((await apiRequest(base)).data);})}>Mark Reviewed</button>
 <button disabled={busy||detail.stale||detail.status!=='reviewed'||!detail.periodClosed} onClick={pdf}>Download Unsigned Form 941</button>
 <p>Review both official return pages and sign before submitting. Deposits are a separate obligation. Retain the filed copy and record agency confirmation under Payments & Statements.</p>
 <p><a href="https://www.irs.gov/instructions/i941" target="_blank" rel="noreferrer">IRS Filing Instructions</a> · <a href="https://tax.ohio.gov/ohtax" target="_blank" rel="noreferrer">Ohio OH|TAX</a> · <a href="https://toledo.oh.gov/pay-taxes" target="_blank" rel="noreferrer">Toledo Withholding Instructions</a></p>
 </section>}
 </div>;
}
