import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext.jsx';
import {apiRequest} from '../lib/api.js';
const sandbox=import.meta.env.VITE_APP_ENV==='sandbox';
export function SandboxGate({children}){
 const [ready,setReady]=useState(!sandbox),[error,setError]=useState('');
 useEffect(()=>{if(!sandbox)return;fetch('/api/environment').then(r=>r.json()).then(p=>{if(p.data?.environment!=='sandbox')throw new Error('This site is not connected to the test backend.');setReady(true);}).catch(e=>setError(e.message));},[]);
 if(!ready)return <main role="alert">{error||'Checking isolated test environment…'}</main>;
 return children;
}
export function SandboxBanner(){
 const {status}=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!sandbox)return null;
 async function fresh(){setBusy(true);setError('');try{const p=await apiRequest('/api/sandbox/scenarios',{method:'POST',body:'{}'});localStorage.setItem('pioneer-admin.active-business-id',p.data.businessUnitId);window.location.assign('/payroll/filings');}catch(e){setError(e.message);setBusy(false);}}
 return <aside style={{background:'#ffe29a',color:'#342400',padding:'12px 20px',borderBottom:'3px solid #a64b00'}}><strong>TEST ONLY — Payroll Sandbox</strong><p>Fictional data. No real payments, tax submissions, email or SMS. Use a TEST business in the selector. September has a completed example; October has hours ready to process.</p>{status==='authenticated'&&<button disabled={busy} onClick={fresh}>{busy?'Creating practice data…':'Create Fresh Practice Scenario'}</button>}{error&&<p role="alert">{error}</p>}</aside>;
}
