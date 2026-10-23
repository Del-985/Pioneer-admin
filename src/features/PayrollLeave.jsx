import {useEffect,useState} from 'react';
import {apiRequest} from '../lib/api.js';

export default function PayrollLeave({businessUnitId}){
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    setData(null);setError('');
    apiRequest('/api/admin/business-units/'+businessUnitId+'/payroll/leave/balances')
      .then(r=>{if(active)setData(r.data);})
      .catch(e=>{if(active)setError(e.message||'Unable to load leave balances.');});
    return()=>{active=false;};
  },[businessUnitId]);
  return <section className="page-panel">
    <h2>PTO & Sick Leave Accrual</h2>
    <p>Each bank earns 1 hour per 30 approved hours worked. Planned leave requires at least 7 calendar days' notice. Unexpected illness is exempt from advance notice.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!data&&!error&&<p>Loading employee leave balances…</p>}
    {data&&<><p>Policy effective: {data.policy.effective_on}. Accrual is credited upon timesheet approval, and corrections reverse outdated credits.</p>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>PTO (hours)</th><th>Sick Leave (hours)</th></tr></thead>
      <tbody>{data.employees.map(e=><tr key={e.employeeId}>
        <td>{e.employeeName}</td>
        <td>{e.balances.pto.balanceHours.toFixed(2)}</td>
        <td>{e.balances.sick.balanceHours.toFixed(2)}</td>
      </tr>)}</tbody></table></div>
    </>}
  </section>;
}
