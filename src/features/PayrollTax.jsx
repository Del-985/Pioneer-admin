import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../lib/api.js';

const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(x||0)/100);
const errText=x=>x instanceof Error?x.message:'Unable to process the tax preview.';
function cents(value){
 const input=String(value).trim();
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(input))return null;
 const [a,b='']=input.split('.');
 const result=Number(a)*100+Number(b.padEnd(2,'0'));
 return Number.isSafeInteger(result)&&result>=0&&result<=5000000000?result:null;
}
function percentBps(value){
 const input=String(value).trim();
 if(!/^(0|[1-9]\d?)(?:\.\d{1,2})?$/.test(input))return null;
 const [a,b='']=input.split('.');
 const result=Number(a)*100+Number(b.padEnd(2,'0'));
 return result>=0&&result<=500?result:null;
}
const emptyElection=()=>({
 employeeId:'',effectiveOn:'2026-10-01',w4FormYear:'2026',
 federalStatus:'single',federalTwoJobs:false,federalStep3Credits:'0',
 federalStep4aIncome:'0',federalStep4bDeductions:'0',federalStep4cExtra:'0',
 ohioIt4Exemptions:'0',schoolDistrictCode:'none',schoolDistrictBasis:'none',
 schoolDistrictRatePercent:'0',toledoWorkplaceConfirmed:false,
 signedFederalW4OnFile:false,signedOhioIt4OnFile:false,
 verifiedSchoolDistrict:false,recordReference:'',
});
const emptyOpening=()=>({
 employeeId:'',priorSocialSecurityWages:'0',priorMedicareWages:'0',
 verifiedFromPayrollRecords:false,recordReference:'',
});
function TaxAmount({label,value}){
 return <span className="tax-payroll-amount">
  <small>{label}</small><strong>{money(value)}</strong>
 </span>;
}
export default function PayrollTax({businessUnitId,employees=[]}){
 const base='/api/admin/business-units/'+businessUnitId+'/payroll';
 const [runs,setRuns]=useState([]);
 const [native,setNative]=useState([]);
 const [taxes,setTaxes]=useState([]);
 const [elections,setElections]=useState([]);
 const [openings,setOpenings]=useState([]);
 const [runId,setRunId]=useState('');
 const [detail,setDetail]=useState(null);
 const [election,setElection]=useState(emptyElection);
 const [opening,setOpening]=useState(emptyOpening);
 const [reimbursementReview,setReimbursementReview]=useState(false);
 const [notes,setNotes]=useState('');
 const [voidReason,setVoidReason]=useState('');
 const [busy,setBusy]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const eligible=useMemo(()=>native.filter(r=>r.status==='approved'&&
  runs.some(run=>run.id===r.runId&&run.status!=='void')),[native,runs]);
 const chosen=eligible.find(x=>x.runId===runId);
 const current=taxes.find(x=>x.runId===runId&&x.status!=='void');
 const openingsForRun=openings;
 const reload=useCallback(async()=>{
  const [r,n,t,e]=await Promise.all([
   apiRequest(base+'/runs'),
   apiRequest(base+'/native/calculations'),
   apiRequest(base+'/tax/calculations'),
   apiRequest(base+'/tax/elections'),
  ]);
  const data={runs:r.data||[],native:n.data||[],taxes:t.data||[],elections:e.data||[]};
  setRuns(data.runs);setNative(data.native);
  setTaxes(data.taxes);setElections(data.elections);
  return data;
 },[base]);
 const loadRun=useCallback(async(id,hasPreview)=>{
  if(!id){setOpenings([]);setDetail(null);return;}
  const path=base+'/runs/'+id+'/tax';
  const q=[apiRequest(path+'/openings')];
  if(hasPreview)q.push(apiRequest(path));
  const [openingData,detailData]=await Promise.all(q);
  setOpenings(openingData.data||[]);
  setDetail(detailData?.data||null);
 },[base]);
 useEffect(()=>{
  let active=true;
  setRuns([]);setNative([]);setTaxes([]);setElections([]);
  setDetail(null);setRunId('');setError('');setNotice('');setLoading(true);
  reload().then(data=>{
   if(active){
    const first=data.native.find(r=>r.status==='approved'&&
     data.runs.some(run=>run.id===r.runId&&run.status!=='void'));
    setRunId(first?.runId||'');
   }
  }).catch(e=>{if(active)setError(errText(e));})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[reload]);
 useEffect(()=>{
  if(!runId){setOpenings([]);setDetail(null);return;}
  let active=true;
  setDetail(null);setOpenings([]);setNotice('');setError('');
  const hasPreview=!!taxes.find(x=>x.runId===runId&&x.status!=='void');
  const openingsApi=apiRequest(base+'/runs/'+runId+'/tax/openings');
  const detailApi=hasPreview?apiRequest(base+'/runs/'+runId+'/tax'):Promise.resolve(null);
  Promise.all([openingsApi,detailApi]).then(([p,q])=>{
   if(active){setOpenings(p.data||[]);setDetail(q?.data||null);}
  }).catch(e=>{if(active)setError(errText(e));});
  return()=>{active=false;};
 },[base,runId,current?.id,current?.status]);
 async function action(label,callback){
  setBusy(label);setError('');setNotice('');
  try{
   await callback();
   const data=await reload();
   const tax=data.taxes.find(x=>x.runId===runId&&x.status!=='void');
   await loadRun(runId,!!tax);
   setNotice(label+' completed.');
   return true;
  }catch(e){setError(errText(e));return false;}
  finally{setBusy('');}
 }
 async function saveElection(event){
  event.preventDefault();
  const amounts={};
  const fields=['federalStep3Credits','federalStep4aIncome',
   'federalStep4bDeductions','federalStep4cExtra'];
  for(const field of fields){
   const value=cents(election[field]);
   if(value===null){setError(field+' must be a valid nonnegative dollar amount.');return;}
   amounts[field+'Cents']=value;
  }
  const rate=percentBps(election.schoolDistrictRatePercent);
  if(rate===null){setError('Enter an earned-income school district rate between 0 and 5 percent.');return;}
  const payload={
   ...amounts,employeeId:election.employeeId,effectiveOn:election.effectiveOn,
   w4FormYear:Number(election.w4FormYear),federalStatus:election.federalStatus,
   federalTwoJobs:election.federalTwoJobs,ohioIt4Exemptions:Number(election.ohioIt4Exemptions),
   schoolDistrictCode:election.schoolDistrictBasis==='none'?'none':election.schoolDistrictCode,
   schoolDistrictBasis:election.schoolDistrictBasis,
   schoolDistrictRateBps:election.schoolDistrictBasis==='none'?0:rate,
   toledoWorkplaceConfirmed:election.toledoWorkplaceConfirmed,
   signedFederalW4OnFile:election.signedFederalW4OnFile,
   signedOhioIt4OnFile:election.signedOhioIt4OnFile,
   verifiedSchoolDistrict:election.verifiedSchoolDistrict,
   recordReference:election.recordReference.trim(),
  };
  const success=await action('Signed-form tax election saved',()=>apiRequest(
   base+'/tax/elections',{method:'POST',body:JSON.stringify(payload)}));
  if(success)setElection(emptyElection());
 }
 async function saveOpening(event){
  event.preventDefault();
  if(!runId)return;
  const ss=cents(opening.priorSocialSecurityWages);
  const med=cents(opening.priorMedicareWages);
  if(ss===null||med===null){setError('Prior-year-to-date wages must be valid nonnegative dollar amounts.');return;}
  const successful=await action('Year-to-date wages verified',()=>apiRequest(
   base+'/runs/'+runId+'/tax/openings',{
    method:'POST',body:JSON.stringify({
     employeeId:opening.employeeId,priorSocialSecurityWagesCents:ss,
     priorMedicareWagesCents:med,verifiedFromPayrollRecords:opening.verifiedFromPayrollRecords,
     recordReference:opening.recordReference.trim(),
    }),
   }));
  if(successful)setOpening(emptyOpening());
 }
 function prepare(){
  action('Withholding draft prepared',()=>apiRequest(base+'/runs/'+runId+'/tax/prepare',{
   method:'POST',body:JSON.stringify({
    reimbursementsVerifiedNonTaxable:reimbursementReview,notes:notes.trim()||undefined,
   }),
  }));
 }
 function approve(){
  if(!window.confirm('Approve the internal tax ESTIMATE? No wages, tax filings or remittances will occur. Federal and state employer payroll tax obligations remain incomplete.'))return;
  action('Withholding preview approved',()=>apiRequest(base+'/runs/'+runId+'/tax/approve',{
   method:'POST',body:JSON.stringify({}),
  }));
 }
 function voidDraft(){
  if(voidReason.trim().length<12)return;
  if(!window.confirm('Void this tax draft so a replacement can be prepared? The original will remain in the audit history.'))return;
  action('Tax draft voided',()=>apiRequest(base+'/runs/'+runId+'/tax/void',{
   method:'POST',body:JSON.stringify({reason:voidReason.trim()}),
  }));
 }
 function set(field,value){setElection(prev=>({...prev,[field]:value}));}
 const readOnly=!!busy||loading;
 return <section className="payroll-tax-workspace">
  <header className="section-heading-row">
   <div><h2>2026 Payroll Tax Withholding</h2>
    <p className="section-subtitle">Review verified W-4 and Ohio IT-4 elections,
      prior wages, withholding estimates, and projected pay for Pioneer's employees.</p></div>
   <button className="secondary-button compact-button" type="button"
    disabled={readOnly} onClick={()=>action('Tax records refreshed',async()=>{})}>Refresh</button>
  </header>
  <p className="payroll-caution">
   <strong>Internal estimate only — NOT PAYABLE.</strong>
   2026 federal, FICA, Ohio withholding effective August 1, Toledo, and verified
   earned-income school districts are supported for weekly/biweekly registers.
   Taxable work outside Toledo, traditional-base school districts, unsupported
   dates or undocumented forms are blocked. Employer FUTA/SUTA, payment
   authorization, payroll deposits and tax filing are not implemented.
   Projected net is NOT a final payable amount.
  </p>
  {error&&<p role="alert" className="form-error section-error">{error}</p>}
  {notice&&<p role="status" className="form-success section-error">{notice}</p>}
  <div className="management-card payroll-tax-step">
   <h3>1. Select Approved Native Earnings</h3>
   <label className="field-label">Payroll Register
    <select aria-label="Tax payroll register" value={runId} onChange={e=>setRunId(e.target.value)}>
     <option value="">Select an approved native payroll</option>
     {eligible.map(item=><option key={item.id} value={item.runId}>
      {item.periodStart} – {item.periodEnd} · {money(item.grossWagesCents)} gross
     </option>)}
    </select>
   </label>
   {!eligible.length&&!loading&&<p className="table-secondary">Approve an earnings
    snapshot in Native Payroll first. Only approved snapshots can be taxed.</p>}
   {chosen&&<div className="payroll-tax-totals">
    <TaxAmount label="Approved gross" value={chosen.grossWagesCents}/>
    <div className="tax-payroll-amount"><small>Tax preview</small>
     <strong>{current?.status||'Not prepared'}</strong></div>
   </div>}
  </div>
  {chosen&&<div className="management-card payroll-tax-step">
   <h3>2. Record Verified Employee Tax Elections</h3>
   <p className="table-secondary">Transcribe only from an employee's signed federal
    W-4 and Ohio IT-4 maintained in secure personnel records. This is NOT an
    electronic substitute for either tax form; don't collect SSNs or bank numbers here.
    Confirm all wages in this pay register are Toledo-taxable; otherwise do not
    prepare tax estimates.</p>
   <form onSubmit={saveElection} className="payroll-tax-form">
    <div className="payroll-tax-form-grid">
     <label className="field-label">Employee
      <select required value={election.employeeId} onChange={e=>set('employeeId',e.target.value)}>
       <option value="">Choose employee</option>
       {employees.map(e=><option key={e.id} value={e.id}>{e.displayName}</option>)}
      </select>
     </label>
     <label className="field-label">Tax Election Effective Date
      <input required type="date" value={election.effectiveOn}
       onChange={e=>set('effectiveOn',e.target.value)}/>
     </label>
     <label className="field-label">Signed W-4 Form Year
      <input required type="number" min="2020" max="2026" step="1"
       value={election.w4FormYear} onChange={e=>set('w4FormYear',e.target.value)}/>
     </label>
     <label className="field-label">Federal W-4 Filing Status
      <select value={election.federalStatus} onChange={e=>set('federalStatus',e.target.value)}>
       <option value="single">Single / Married Filing Separately</option>
       <option value="married_joint">Married Filing Jointly</option>
       <option value="head_of_household">Head of Household</option>
      </select>
     </label>
     <label className="field-label">Step 3 Annual Credits ($)
      <input required type="number" step=".01" min="0" value={election.federalStep3Credits}
       onChange={e=>set('federalStep3Credits',e.target.value)}/>
     </label>
     <label className="field-label">Step 4(a) Other Annual Income ($)
      <input required type="number" step=".01" min="0" value={election.federalStep4aIncome}
       onChange={e=>set('federalStep4aIncome',e.target.value)}/>
     </label>
     <label className="field-label">Step 4(b) Annual Deductions ($)
      <input required type="number" step=".01" min="0" value={election.federalStep4bDeductions}
       onChange={e=>set('federalStep4bDeductions',e.target.value)}/>
     </label>
     <label className="field-label">Step 4(c) Extra Withholding Per Pay ($)
      <input required type="number" step=".01" min="0" value={election.federalStep4cExtra}
       onChange={e=>set('federalStep4cExtra',e.target.value)}/>
     </label>
     <label className="field-label">Ohio IT-4 Exemptions
      <input required type="number" min="0" max="100" step="1"
       value={election.ohioIt4Exemptions}
       onChange={e=>set('ohioIt4Exemptions',e.target.value)}/>
     </label>
     <label className="field-label">Resident School District Tax Basis
      <select aria-label="School district tax basis" value={election.schoolDistrictBasis}
       onChange={e=>set('schoolDistrictBasis',e.target.value)}>
       <option value="none">Verified: No Taxing School District</option>
       <option value="earned_income">Verified: Earned-Income Base</option>
       <option value="traditional" disabled>Traditional Base — Not Supported</option>
      </select>
     </label>
     {election.schoolDistrictBasis==='earned_income'&&<>
      <label className="field-label">Verified School District Code
       <input required pattern="[0-9]{4}" maxLength={4} value={election.schoolDistrictCode==='none'?'':election.schoolDistrictCode}
        onChange={e=>set('schoolDistrictCode',e.target.value)}/>
      </label>
      <label className="field-label">District Withholding Rate (%)
       <input required type="number" min=".01" max="5" step=".01"
        value={election.schoolDistrictRatePercent}
        onChange={e=>set('schoolDistrictRatePercent',e.target.value)}/>
      </label>
     </>}
    </div>
    <label className="payroll-tax-checkbox">
     <input type="checkbox" checked={election.federalTwoJobs}
      onChange={e=>set('federalTwoJobs',e.target.checked)}/>
     W-4 Step 2(c) multiple-jobs box checked
    </label>
    <label className="payroll-tax-checkbox">
     <input type="checkbox" checked={election.signedFederalW4OnFile}
      onChange={e=>set('signedFederalW4OnFile',e.target.checked)}/>
     Signed federal W-4 is on file; employee does NOT claim withholding exemption
    </label>
    <label className="payroll-tax-checkbox">
     <input type="checkbox" checked={election.signedOhioIt4OnFile}
      onChange={e=>set('signedOhioIt4OnFile',e.target.checked)}/>
     Signed Ohio IT-4 is on file and exemptions were verified
    </label>
    <label className="payroll-tax-checkbox">
     <input type="checkbox" checked={election.verifiedSchoolDistrict}
      onChange={e=>set('verifiedSchoolDistrict',e.target.checked)}/>
     Employee's residential school district and applicable tax rate were verified
    </label>
    <label className="payroll-tax-checkbox">
     <input type="checkbox" checked={election.toledoWorkplaceConfirmed}
      onChange={e=>set('toledoWorkplaceConfirmed',e.target.checked)}/>
     All taxable work included in this register qualifies for Toledo's 2.5% withholding
    </label>
    <label className="field-label">W-4 / IT-4 Record Reference
     <input required minLength={12} maxLength={240} value={election.recordReference}
      placeholder="Signed forms held in personnel files, dated..."
      onChange={e=>set('recordReference',e.target.value)}/>
    </label>
    <button type="submit" className="primary-button" disabled={readOnly||
     !election.employeeId||!election.signedFederalW4OnFile||
     !election.signedOhioIt4OnFile||!election.verifiedSchoolDistrict||
     !election.toledoWorkplaceConfirmed}>Save Verified Tax Election</button>
   </form>
   {!!elections.length&&<div className="table-wrap"><table className="feature-table">
    <thead><tr><th>Employee</th><th>Effective</th><th>W-4</th>
     <th>Ohio Exemptions</th><th>School District</th></tr></thead>
    <tbody>{elections.map(e=><tr key={e.id}><td>{e.employeeName}</td>
     <td>{e.effectiveOn}</td><td>{e.federalStatus}</td>
     <td>{e.ohioIt4Exemptions}</td>
     <td>{e.schoolDistrictCode==='none'?'None (verified)':e.schoolDistrictCode}</td>
    </tr>)}</tbody>
   </table></div>}
  </div>}
  {chosen&&<div className="management-card payroll-tax-step">
   <h3>3. Verify Prior Calendar-Year-to-Date Wages</h3>
   <p className="table-secondary">For every employee in this specific pay register,
    record verified Social Security and Medicare wages paid earlier in 2026.
    These may be zero only when supported by actual payroll history.
    This does NOT mean simply entering wages accrued in Pioneer Books.</p>
   <form onSubmit={saveOpening} className="payroll-tax-form">
    <div className="payroll-tax-form-grid">
     <label className="field-label">Employee
      <select required value={opening.employeeId}
       onChange={e=>setOpening(p=>({...p,employeeId:e.target.value}))}>
       <option value="">Select employee</option>
       {employees.map(e=><option key={e.id} value={e.id}>{e.displayName}</option>)}
      </select>
     </label>
     <label className="field-label">Prior 2026 Social Security Wages ($)
      <input required type="number" min="0" step=".01"
       value={opening.priorSocialSecurityWages}
       onChange={e=>setOpening(p=>({...p,priorSocialSecurityWages:e.target.value}))}/>
     </label>
     <label className="field-label">Prior 2026 Medicare Wages ($)
      <input required type="number" min="0" step=".01"
       value={opening.priorMedicareWages}
       onChange={e=>setOpening(p=>({...p,priorMedicareWages:e.target.value}))}/>
     </label>
    </div>
    <label className="payroll-tax-checkbox">
     <input type="checkbox" checked={opening.verifiedFromPayrollRecords}
      onChange={e=>setOpening(p=>({...p,verifiedFromPayrollRecords:e.target.checked}))}/>
     I reconciled both prior wage totals against actual payroll records
    </label>
    <label className="field-label">Prior Wage Evidence Reference
     <input required minLength={12} maxLength={240} value={opening.recordReference}
      placeholder="2026 payroll register or signed wage-history documentation"
      onChange={e=>setOpening(p=>({...p,recordReference:e.target.value}))}/>
    </label>
    <button type="submit" className="primary-button" disabled={readOnly||
     !opening.employeeId||!opening.verifiedFromPayrollRecords||
     opening.recordReference.trim().length<12}>
     Save Verified Prior Wages</button>
   </form>
   {!!openingsForRun.length&&<div className="table-wrap"><table className="feature-table">
    <thead><tr><th>Employee</th><th>Prior Social Security Wages</th>
     <th>Prior Medicare Wages</th><th>Evidence</th></tr></thead>
    <tbody>{openingsForRun.map(o=><tr key={o.id}>
     <td>{o.employeeName}</td><td>{money(o.priorSocialSecurityWagesCents)}</td>
     <td>{money(o.priorMedicareWagesCents)}</td>
     <td>{o.verifiedFromPayrollRecords?'Verified':'Unverified'}</td>
    </tr>)}</tbody>
   </table></div>}
  </div>}
  {chosen&&!current&&<div className="management-card payroll-tax-step">
   <h3>4. Prepare Withholding Preview</h3>
   <p>Each employee requires a signed W-4/IT-4 election effective at period start,
    verified school district, Toledo wage coverage, and an exact prior-wages entry.
    Tax amounts are estimates until independently reviewed and approved.</p>
   <label className="payroll-tax-checkbox">
    <input type="checkbox" checked={reimbursementReview}
     onChange={e=>setReimbursementReview(e.target.checked)}/>
    I reviewed any separate reimbursements and verified they are non-taxable
    under the applicable accountable-plan rules (leave unchecked if none)
   </label>
   <label className="field-label">Calculation Review Notes
    <textarea maxLength={2000} rows={2} value={notes}
     onChange={e=>setNotes(e.target.value)}
     placeholder="Known tax and payroll assumptions requiring review"/>
   </label>
   <button type="button" className="primary-button" disabled={readOnly}
    onClick={prepare}>Prepare Withholding Draft</button>
  </div>}
  {detail&&<div className="management-card payroll-tax-step">
   <h3>4. Tax Withholding &amp; Projected Pay Review</h3>
   <p className="payroll-caution">
    <strong>NOT A PAYCHECK OR OFFICIAL PAY STUB.</strong> Projected pay is a
    withholding review estimate. Actual payment and employer tax completion
    are disabled. No deposit, journal settlement, payroll tax payment, or
    government return is submitted by approving this page.
   </p>
   <div className="payroll-tax-totals">
    <TaxAmount label="Gross Wages" value={detail.grossCents}/>
    <TaxAmount label="Federal Income" value={detail.federalIncomeCents}/>
    <TaxAmount label="Ohio Income" value={detail.ohioIncomeCents}/>
    <TaxAmount label="Toledo Income" value={detail.toledoIncomeCents}/>
    <TaxAmount label="School District" value={detail.schoolIncomeCents}/>
    <TaxAmount label="Social Security" value={detail.socialSecurityCents}/>
    <TaxAmount label="Medicare" value={detail.medicareCents}/>
    <TaxAmount label="Additional Medicare" value={detail.additionalMedicareCents}/>
    <TaxAmount label="Employee Withholding" value={detail.totalWithholdingCents}/>
    <TaxAmount label="Voluntary Deductions" value={detail.voluntaryDeductionsCents}/>
    <TaxAmount label="Separate Reimbursements" value={detail.reimbursementCents}/>
    <TaxAmount label="Projected Net — Not Payable" value={detail.projectedNetCents}/>
    <TaxAmount label="Employer Social Security" value={detail.employerSocialSecurityCents}/>
    <TaxAmount label="Employer Medicare" value={detail.employerMedicareCents}/>
   </div>
   <div className="table-wrap"><table className="feature-table">
    <thead><tr><th>Employee</th><th>Gross</th><th>Federal</th>
     <th>Ohio</th><th>Toledo</th><th>School</th><th>FICA</th>
     <th>Total Withheld</th><th>Projected Net</th></tr></thead>
    <tbody>{(detail.lines||[]).map(l=><tr key={l.employeeId}>
     <td>{l.employeeName}</td><td>{money(l.grossCents)}</td>
     <td>{money(l.federalIncomeCents)}</td><td>{money(l.ohioIncomeCents)}</td>
     <td>{money(l.toledoIncomeCents)}</td><td>{money(l.schoolIncomeCents)}</td>
     <td>{money(l.socialSecurityCents+l.medicareCents+l.additionalMedicareCents)}</td>
     <td>{money(l.totalWithholdingCents)}</td>
     <td><strong>{money(l.projectedNetCents)}</strong></td>
    </tr>)}</tbody>
   </table></div>
   {detail.status==='draft'&&<>
    <button type="button" className="primary-button" disabled={readOnly}
     onClick={approve}>Approve Tax Estimate — No Payment</button>
    <label className="field-label">Reason for Voiding Draft
     <textarea rows={2} minLength={12} maxLength={1000} value={voidReason}
      onChange={e=>setVoidReason(e.target.value)}/>
    </label>
    <button type="button" className="secondary-button" disabled={readOnly||
     voidReason.trim().length<12} onClick={voidDraft}>Void and Recalculate</button>
   </>}
   {detail.status==='approved'&&<p className="payroll-caution">
    <strong>Approved estimate — immutable.</strong> Approval locks the
    calculation for audit but does not authorize wages, transfers, or tax filings.</p>}
   <h4>Calculation Audit</h4>
   {(detail.events||[]).map((event,i)=><p className="table-secondary" key={i}>
    {event.action} · {new Date(event.createdAt).toLocaleString()}</p>)}
  </div>}
  <p className="table-secondary">
   Rules: <a target="_blank" rel="noopener noreferrer" href="https://www.irs.gov/publications/p15t">
   2026 IRS Publication 15-T</a>, <a target="_blank" rel="noopener noreferrer"
   href="https://tax.ohio.gov/business/employer-withholding">Ohio withholding</a>,
   and <a target="_blank" rel="noopener noreferrer" href="https://toledo.oh.gov/pay-taxes">
   Toledo taxation</a>. Tax profiles are transcribed references to signed documents,
   not electronic substitute W-4 submissions.
  </p>
 </section>;
}
