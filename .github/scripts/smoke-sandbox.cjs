const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage();let environment='production',authRequests=0,created=0;const external=[];
  page.on('request',r=>{if(r.url().includes('api.pioneerlegacyworks.com'))external.push(r.url());});
  await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let data=[];
   if(path==='/api/environment')data={environment};
   if(path==='/api/auth/me'){authRequests++;data={user:{id:'test-admin',displayName:'TEST Admin'},access:[]};}
   if(path==='/api/sandbox/scenarios'){created++;data={businessUnitId:'test-unit'};}
   await route.fulfill({contentType:'application/json',body:JSON.stringify({data})});
  });
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('This site is not connected to the test backend.').waitFor();
  if(authRequests)throw new Error('Sandbox reached auth before validating environment');
  environment='sandbox';await page.reload();
  await page.getByText('TEST ONLY — Payroll Sandbox',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Create Fresh Practice Scenario',exact:true}).click();
  await page.waitForURL('**/payroll/filings');
  if(created!==1||external.length)throw new Error('Scenario creation or origin isolation failed');
  console.log('PASS: sandbox rejects production environment, displays test label, uses same origin and creates fresh scenario');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
