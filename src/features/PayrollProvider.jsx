import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../lib/api.js';

const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(c)||0)/100);
const headers=['employeeId','grossCents','federalWithholdingCents','stateWithholdingCents',
  'socialSecurityCents','medicareCents','otherDeductionsCents','netCents',
  'paymentStatus','paidOn','statementReference'];
const moneyKeys=headers.filter(x=>x.endsWith('Cents'));
function todayDetroit(){
  const parts=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',
    day:'2-digit',timeZone:'America/Detroit'}).formatToParts(new Date());
  const part=kind=>parts.find(p=>p.type===kind)?.value||'';
  return part('year')+'-'+part('month')+'-'+part('day');
}
function escapeCSV(value){
  const text=String(value??'');
  const clean=/^[\s]*[=+@-]/.test(text)?"'"+text:text;
  return '"'+clean.replaceAll('"','""')+'"';
}
function download(text,filename){
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),250);
}
// CSV parser supports quoted fields and CRLF. No external CSV library,
// no dangerous eval/HTML rendering, and no unknown columns in payroll results.
function readCSV(source){
  const text=source.replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',inQuotes=false,closedQuote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQuotes){
      if(ch==='"'){
        if(text[i+1]==='"'){field+='"';i++;}
        else {inQuotes=false;closedQuote=true;}
      }else field+=ch;
      continue;
    }
    if(ch==='"'){
      if(field!==''||closedQuote)throw new Error('Invalid CSV quote position.');
      inQuotes=true;
    }else if(ch===','||ch==='\n'||ch==='\r'){
      row.push(field);field='';closedQuote=false;
      if(ch!==','){
        if(ch==='\r'&&text[i+1]==='\n')i++;
        if(row.some(value=>value!==''))rows.push(row);
        row=[];
      }
    }else{
      if(closedQuote)throw new Error('Unexpected content after a quoted CSV value.');
      field+=ch;
    }
  }
  if(inQuotes)throw new Error('CSV contains an unclosed quote.');
  if(field||row.length){row.push(field);if(row.some(v=>v!==''))rows.push(row);}
  return rows;
}
function parseResultsCSV(text,expected){
  const all=readCSV(text);
  if(!all.length)throw new Error('The imported provider CSV is empty.');
  if(all[0].length!==headers.length||headers.some((key,i)=>all[0][i].trim()!==key))
    throw new Error('Unexpected columns. Download the Pioneer results template and populate it with your provider figures.');
  const expectedIds=new Set(expected.map(r=>r.employeeId));
  const seen=new Set();
  const results=all.slice(1).map((fields,index)=>{
    if(fields.length!==headers.length)throw new Error('Row '+(index+2)+' has an incorrect column count.');
    const record=Object.fromEntries(headers.map((key,i)=>[key,fields[i].trim()]));
    if(!expectedIds.has(record.employeeId)||seen.has(record.employeeId))
      throw new Error('Row '+(index+2)+' contains an unknown or duplicate employee ID.');
    seen.add(record.employeeId);
    for(const key of moneyKeys){
      if(!/^(0|[1-9]\d*)$/.test(record[key])||Number(record[key])>50000000)
        throw new Error('Row '+(index+2)+': '+key+' must be a nonnegative integer number of cents.');
      record[key]=Number(record[key]);
    }
    if(!['pending','paid','failed'].includes(record.paymentStatus))
      throw new Error('Row '+(index+2)+' has an invalid paymentStatus. Use pending, paid or failed.');
    if(record.paidOn&&!/^\d{4}-\d{2}-\d{2}$/.test(record.paidOn))
      throw new Error('Row '+(index+2)+' has an invalid paidOn date (YYYY-MM-DD).');
    if(record.paymentStatus==='paid'&&!record.paidOn)
      throw new Error('Row '+(index+2)+' must include paidOn for payments reported paid.');
    if(record.paymentStatus!=='paid'&&record.paidOn)
      throw new Error('Row '+(index+2)+' must leave paidOn blank if payment is pending or failed.');
    const withheld=record.federalWithholdingCents+record.stateWithholdingCents+
      record.socialSecurityCents+record.medicareCents+record.otherDeductionsCents;
    if(record.grossCents!==record.netCents+withheld)
      throw new Error('Row '+(index+2)+' gross does not equal net plus deductions.');
    if(record.statementReference.length>120)
      throw new Error('Row '+(index+2)+' statementReference is too long.');
    return{
      ...record,paidOn:record.paidOn||null,
      statementReference:record.statementReference||null,
    };
  });
  if(results.length!==expected.length)
    throw new Error('Include exactly one result for every employee in this payroll register.');
  return results;
}
function buildTemplate(lines){
  const data=[headers,...lines.map(line=>[
    line.employeeId,'','','','','','','','pending','','',
  ])];
  return '\uFEFF'+data.map(row=>row.map(escapeCSV).join(',')).join('\r\n')+'\r\n';
}
const errString=err=>err instanceof Error?err.message:'Unable to process the provider payroll handoff.';

export default function PayrollProvider({businessUnitId}){
  const base='/api/admin/business-units/'+businessUnitId+'/payroll';
  const [runs,setRuns]=useState([]);
  const [batches,setBatches]=useState([]);
  const [runId,setRunId]=useState('');
  const [detail,setDetail]=useState(null);
  const [providerName,setProviderName]=useState('');
  const [externalReference,setExternalReference]=useState('');
  const [submittedOn,setSubmittedOn]=useState(todayDetroit);
  const [fileInfo,setFileInfo]=useState('');
  const [results,setResults]=useState(null);
  const [importKey,setImportKey]=useState(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [confirmedSource,setConfirmedSource]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const reload=useCallback(async()=>{
    const [r,b]=await Promise.all([apiRequest(base+'/runs'),apiRequest(base+'/provider-batches')]);
    setRuns(r.data||[]);
    setBatches(b.data||[]);
    return{runs:r.data||[],batches:b.data||[]};
  },[base]);
  useEffect(()=>{
    let active=true;
    setRunId('');setDetail(null);setRuns([]);setBatches([]);
    setError('');setBusy('Loading');
    reload().then(data=>{
      if(!active)return;
      const current=data.runs.find(r=>r.status==='posted');
      setRunId(current?.id||'');
    }).catch(e=>{if(active)setError(errString(e));})
      .finally(()=>{if(active)setBusy('');});
    return()=>{active=false;};
  },[reload]);
  const selectedRun=runs.find(x=>x.id===runId);
  const selectedBatch=batches.find(x=>x.runId===runId);
  const prepared=detail?.status==='prepared';
  const submitted=detail?.status==='submitted';
  const imported=detail?.status==='imported';
  const ready=selectedRun?.status==='posted';
  const selectedSource=detail?.sourceLines||[];
  const totalGross=results?.reduce((n,x)=>n+x.grossCents,0)||0;
  const totalNet=results?.reduce((n,x)=>n+x.netCents,0)||0;
  const variance=results?totalGross-(detail?.sourceGrossCents||0):0;
  const hasVariance=variance!==0;
  const paidCount=results?.filter(x=>x.paymentStatus==='paid').length||0;

  const refreshDetail=useCallback(async(id)=>{
    if(!id){setDetail(null);return;}
    try{
      const response=await apiRequest(base+'/runs/'+id+'/provider');
      setDetail(response.data);
      setProviderName(response.data.providerName||'');
      setExternalReference(response.data.externalReference||'');
      setSubmittedOn(response.data.submittedOn||todayDetroit());
    }catch(e){
      if(e.status===404){setDetail(null);setExternalReference('');}
      else throw e;
    }
  },[base]);

  useEffect(()=>{
    let active=true;
    setDetail(null);setResults(null);setFileInfo('');setImportKey(null);
    setAcknowledged(false);setConfirmedSource(false);setError('');setSuccess('');
    if(!runId||!selectedBatch)return;
    apiRequest(base+'/runs/'+runId+'/provider')
      .then(payload=>{if(active){setDetail(payload.data);
        setProviderName(payload.data.providerName||'');
        setExternalReference(payload.data.externalReference||'');
        setSubmittedOn(payload.data.submittedOn||todayDetroit());}})
      .catch(err=>{if(active)setError(errString(err));});
    return()=>{active=false;};
  },[base,runId,selectedBatch?.id]);

  async function action(label,callback){
    setBusy(label);setError('');setSuccess('');
    try{
      const res=await callback();
      await reload();
      await refreshDetail(runId);
      setSuccess(label+' completed.');
      return res;
    }catch(e){setError(errString(e));return null;}
    finally{setBusy('');}
  }
  async function prepare(){
    if(!ready)return;
    if(!providerName.trim()){setError('Enter the external payroll provider name.');return;}
    await action('Provider export prepared',()=>apiRequest(base+'/runs/'+runId+'/provider/prepare',{
      method:'POST',body:JSON.stringify({providerName:providerName.trim()})
    }));
  }
  async function getSourceExport(){
    await action('Payroll CSV downloaded',async()=>{
      const csv=await apiRequest(base+'/runs/'+runId+'/provider/export');
      if(typeof csv!=='string')throw new Error('Invalid payroll export response.');
      download(csv,'pioneer-payroll-provider-'+selectedRun.periodStart+'.csv');
    });
  }
  async function markSubmitted(){
    if(!window.confirm('Confirm that you have ALREADY sent the exported payroll data to '+
      detail.providerName+' outside Pioneer. This does not initiate a submission or transfer money.'))return;
    await action('External submission recorded',()=>apiRequest(base+'/runs/'+runId+'/provider/submitted',{
      method:'POST',body:JSON.stringify({externalReference,submittedOn})
    }));
  }
  async function readFile(event){
    setError('');setResults(null);setImportKey(null);setFileInfo('');setAcknowledged(false);setConfirmedSource(false);
    const file=event.target.files?.[0];
    if(!file)return;
    if(file.size>500000){setError('Payroll CSV must be smaller than 500 KB.');return;}
    try{
      const text=await file.text();
      const parsed=parseResultsCSV(text,selectedSource);
      setResults(parsed);setImportKey(crypto.randomUUID());setFileInfo(file.name);
    }catch(e){setError(errString(e));}
  }
  async function importResults(){
    if(!results?.length||!importKey||!confirmedSource||(hasVariance&&!acknowledged))return;
    if(!window.confirm('Import these EXTERNAL provider figures for '+results.length+
      ' employees? This import is permanent and cannot be repeated. It DOES NOT settle wages in Pioneer Books.'))return;
    const result=await action('Provider results imported',()=>apiRequest(
      base+'/runs/'+runId+'/provider/import',{
        method:'POST',body:JSON.stringify({
          importKey,
          acknowledgeGrossDifference:hasVariance&&acknowledged,rows:results,
        }),
      }));
    if(result){setResults(null);setImportKey(null);setFileInfo('');setConfirmedSource(false);}
  }
  return <section className="payroll-provider-panel">
    <header className="section-heading-row">
      <div><h2>Payroll Provider Handoff</h2>
        <p className="section-subtitle">Export approved and posted wages, record external submission,
          and import the provider's actual payroll figures.</p></div>
      <button type="button" className="secondary-button compact-button" disabled={!!busy}
        onClick={()=>action('Provider records refreshed',async()=>{})}>Refresh</button>
    </header>
    <p className="payroll-caution"><strong>Controlled CSV workflow.</strong> Pioneer does not contact
      a payroll provider or move money. You must submit the file to your external payroll service
      and obtain final provider results. Enter no SSNs, bank details, or other sensitive employee
      identifiers in these CSVs. Imported payment status is provider-reported and not bank-verified.</p>
    {error&&<p className="form-error section-error" role="alert">{error}</p>}
    {success&&<p className="form-success section-error" role="status">{success}</p>}
    <section className="management-card payroll-provider-step">
      <h3>1. Choose a Posted Payroll Register</h3>
      <label className="field-label">Payroll Period
        <select aria-label="Provider payroll register" value={runId} onChange={e=>setRunId(e.target.value)}>
          <option value="">Select posted payroll</option>
          {runs.filter(r=>r.status==='posted').map(r=><option value={r.id} key={r.id}>
            {r.periodStart} – {r.periodEnd} · {money(r.grossCents)} estimated gross
            {batches.find(b=>b.runId===r.id)?' · Provider prepared':''}
          </option>)}
        </select>
      </label>
      {!runs.some(x=>x.status==='posted')&&<p className="table-secondary">
        No posted payroll registers are available. Prepare, approve, and post a gross
        payroll register under Pay Registers first.</p>}
      {selectedRun&&<p className="table-secondary">
        Pioneer Books gross accrual: <strong>{money(selectedRun.grossCents)}</strong>.
        This is only an estimate; provider results may differ.</p>}
    </section>
    {ready&&<section className="management-card payroll-provider-step">
      <h3>2. Export for Your Payroll Provider</h3>
      {!detail?<form onSubmit={e=>{e.preventDefault();void prepare();}}>
        <label className="field-label">Provider Name
          <input required maxLength={100} minLength={2} value={providerName}
            placeholder="Your payroll company"
            onChange={e=>setProviderName(e.target.value)}/></label>
        <div className="field-admin-actions"><button className="primary-button"
          type="submit" disabled={!!busy||providerName.trim().length<2}>
          Prepare Provider Export</button></div>
      </form>:<>
        <div className="payroll-provider-status">
          <span>Provider: <strong>{detail.providerName}</strong></span>
          <span>Stage: <strong>{detail.status}</strong></span>
          <span>Employees: <strong>{detail.expectedEmployeeCount}</strong></span>
        </div>
        <button className="secondary-button" type="button" disabled={!!busy}
          onClick={()=>void getSourceExport()}>Download Approved Hours &amp; Gross CSV</button>
        <p className="table-secondary">Export contains employee IDs, names, approved hours and estimated
          gross pay. No account details, payment instructions, or payroll taxes are included.
          Include any separate bonuses, retro-pay adjustments, or reimbursements using
          your provider's own payroll workflow.</p>
      </>}
    </section>}
    {prepared&&<section className="management-card payroll-provider-step">
      <h3>3. Record External Submission</h3>
      <p>After uploading the exported wages into your payroll provider and receiving its
        reference number, record the handoff here to prevent accidental duplicate processing.</p>
      <div className="payroll-provider-form">
        <label className="field-label">Provider Reference
          <input minLength={4} maxLength={120} required placeholder="External batch or confirmation ID"
            value={externalReference} onChange={e=>setExternalReference(e.target.value)}/></label>
        <label className="field-label">Date Submitted
          <input type="date" max={todayDetroit()} required value={submittedOn}
            onChange={e=>setSubmittedOn(e.target.value)}/></label>
      </div>
      <button type="button" className="primary-button" disabled={!!busy||
        externalReference.trim().length<4}
        onClick={()=>void markSubmitted()}>Mark Externally Submitted</button>
    </section>}
    {(submitted||imported)&&<section className="management-card payroll-provider-step">
      <h3>3. External Submission Recorded</h3>
      <div className="payroll-provider-status">
        <span>Provider reference: <strong>{detail.externalReference}</strong></span>
        <span>Submitted: <strong>{detail.submittedOn}</strong></span>
      </div>
      <p className="table-secondary">Pioneer recorded your confirmation. It did not
        transmit the payroll data automatically.</p>
    </section>}
    {submitted&&<section className="management-card payroll-provider-step">
      <h3>4. Import External Payroll Results</h3>
      <p>Get the payroll results from your provider. Fill Pioneer's standardized results
        template with each employee's actual gross wages, deductions, net wages and payment
        status. All monetary figures use <strong>integer cents</strong> (for example,
        1234 means $12.34). Include every employee exactly once.</p>
      <button className="secondary-button compact-button" type="button"
        onClick={()=>download(buildTemplate(selectedSource),
          'pioneer-provider-results-template-'+detail.periodStart+'.csv')}>
        Download Results CSV Template
      </button>
      <label className="field-label">Completed Provider Results CSV
        <input type="file" accept=".csv,text/csv" onChange={e=>void readFile(e)}/>
      </label>
      {results&&<div className="payroll-provider-preview">
        <h4>Provider Results Preview — {fileInfo}</h4>
        <div className="payroll-provider-status">
          <span>Employees <strong>{results.length}</strong></span>
          <span>Provider gross <strong>{money(totalGross)}</strong></span>
          <span>Provider net <strong>{money(totalNet)}</strong></span>
          <span>Gross variance <strong>{money(variance)}</strong></span>
          <span>Reported paid <strong>{paidCount}</strong></span>
        </div>
        <div className="table-wrap"><table className="feature-table">
          <thead><tr><th>Employee</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Provider Payment</th></tr></thead>
          <tbody>{results.map(x=>{
            const employee=selectedSource.find(row=>row.employeeId===x.employeeId);
            return <tr key={x.employeeId}><td>{employee?.employeeName||x.employeeId}</td>
              <td>{money(x.grossCents)}</td><td>{money(x.grossCents-x.netCents)}</td>
              <td>{money(x.netCents)}</td><td>{x.paymentStatus}{x.paidOn?' · '+x.paidOn:''}</td>
            </tr>;
          })}</tbody>
        </table></div>
        {hasVariance&&<label className="payroll-provider-confirm">
          <input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/>
          <span>I reviewed the {money(variance)} difference from Pioneer's gross estimate
            against the provider's final report.</span>
        </label>}
        <label className="payroll-provider-confirm">
          <input type="checkbox" checked={confirmedSource} onChange={e=>setConfirmedSource(e.target.checked)}/>
          <span>I verified these figures against an actual external payroll provider report.
            They have not been generated or calculated by Pioneer.</span>
        </label>
        <button type="button" className="primary-button"
          disabled={!!busy||!confirmedSource||(hasVariance&&!acknowledged)}
          onClick={()=>void importResults()}>Import Provider Results Once</button>
      </div>}
    </section>}
    {imported&&<section className="management-card payroll-provider-step">
      <h3>4. Provider Results Imported</h3>
      <div className="payroll-provider-status">
        <span>Gross <strong>{money(detail.providerGrossCents)}</strong></span>
        <span>Withheld / deducted <strong>{money(detail.providerDeductionsCents)}</strong></span>
        <span>Net <strong>{money(detail.providerNetCents)}</strong></span>
      </div>
      <div className="table-wrap"><table className="feature-table">
        <thead><tr><th>Employee</th><th>Gross</th><th>Net</th><th>Provider-reported Payment</th></tr></thead>
        <tbody>{(detail.results||[]).map(x=><tr key={x.employeeId}>
          <td>{x.employeeName}</td><td>{money(x.grossCents)}</td>
          <td>{money(x.netCents)}</td><td>{x.paymentStatus}{x.paidOn?' · '+x.paidOn:''}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="payroll-caution"><strong>Books reconciliation pending.</strong>
        Imported provider figures do not record cash settlement, tax liabilities, or bank
        reconciliation in Pioneer Books. That belongs to v0.4.3.</p>
    </section>}
  </section>;
}
