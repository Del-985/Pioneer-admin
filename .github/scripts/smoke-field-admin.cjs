const { chromium } = require('playwright');
const { spawn } = require('node:child_process');

const origin='http://127.0.0.1:4173';
const bu='11111111-1111-4111-8111-111111111111';
const employee='22222222-2222-4222-8222-222222222222';
const job='33333333-3333-4333-8333-333333333333';
const report='44444444-4444-4444-8444-444444444444';
const headers={'content-type':'application/json','access-control-allow-origin':origin,
 'access-control-allow-credentials':'true',
 'access-control-allow-methods':'GET,POST,PATCH,PUT,OPTIONS',
 'access-control-allow-headers':'Content-Type'};
const workOrder={id:job,workOrderNumber:'POS-001',title:'Driveway Snow Removal',
 status:'scheduled',assignedEmployeeId:employee,scheduledStart:'2026-12-01T03:00:00Z'};
async function run(){
 const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173'],
  {stdio:['ignore','pipe','pipe']});
 let browser=null;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];
  let approvals=0,shiftCreates=0,routeCreates=0;
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('https://api.pioneerlegacyworks.com/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   let response={data:[]};
   if(path==='/api/auth/me')response={data:{
     user:{id:'55555555-5555-4555-8555-555555555555',email:'manager@example.test',displayName:'Test Manager'},
     access:[{role:{key:'business_admin'},permissions:['work_orders.read','work_orders.write',
       'employees.read','employees.write','scheduling.read','scheduling.write']}]}};
   else if(path==='/api/admin/business-units')response={data:[{id:bu,name:'Pioneer Outdoor Services'}]};
   else if(path.includes('/field/reports/')&&path.endsWith('/review')){approvals++;response={data:{id:report,status:'approved'}};}
   else if(path.endsWith('/field/reports'))response={data:[{
     id:report,workOrderId:job,workOrderNumber:'POS-001',jobTitle:'Driveway Snow Removal',
     employeeName:'Worker One',status:'submitted',saltApplied:true,saltAmountLbs:2.5,
     completionNotes:'Driveway cleared',issueNotes:null,submittedAt:'2026-12-01T05:00:00Z'
   }]};
   else if(path.endsWith('/photos'))response={data:[]};
   else if(path.endsWith('/field/shifts')){
     if(request.method()==='POST')shiftCreates++;
     response={data:[]};
   }else if(path.endsWith('/field/routes')){
     if(request.method()==='POST')routeCreates++;
     response={data:[]};
   }else if(path.endsWith('/field/availability'))response={data:[{id:'s1',weekday:5,
     startTime:'20:00:00',endTime:'06:00:00',available:true,employeeName:'Worker One'}]};
   else if(path.endsWith('/employees'))response={data:[{id:employee,displayName:'Worker One',status:'active'}]};
   else if(path.endsWith('/work-orders'))response={data:[workOrder]};
   await route.fulfill({status:200,headers,body:JSON.stringify(response)});
  });
  await page.goto(origin+'/field',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Field Operations'}).waitFor({timeout:10000});
  await page.getByText('Driveway cleared').waitFor({timeout:10000});
  console.log('PASS: Admin Field Operations reports loaded');
  await page.getByRole('button',{name:'Approve Work'}).click();
  await page.getByText('Report approved.').waitFor({timeout:10000});
  if(approvals!==1)throw new Error('Approval request missing');
  console.log('PASS: Manager approved work');
  await page.getByRole('tab',{name:'Shift Offers'}).click();
  await page.getByLabel('Shift Title').fill('Overnight Snow Shift');
  await page.getByLabel('Starts',{exact:true}).fill('2026-12-01T20:00');
  await page.getByLabel('Ends',{exact:true}).fill('2026-12-02T06:00');
  await page.getByRole('button',{name:'Create Shift'}).click();
  await page.getByText('Shift created.').waitFor({timeout:10000});
  if(shiftCreates!==1)throw new Error('Shift creation request missing');
  console.log('PASS: Manager created shift');
  await page.getByRole('tab',{name:'Routes & Crews'}).click();
  await page.getByLabel('Route Name').fill('North Toledo Overnight');
  await page.getByRole('button',{name:'Create Route'}).click();
  await page.getByText('Crew route saved.').waitFor({timeout:10000});
  if(routeCreates!==1)throw new Error('Route creation request missing');
  console.log('PASS: Manager created route');
  await page.getByRole('tab',{name:'Availability'}).click();
  await page.getByText('Friday').waitFor({timeout:10000});
  console.log('PASS: Manager viewed overnight availability');
  if(errors.length)throw new Error('Uncaught errors: '+errors.join('\n'));
  console.log('PASS: Admin field v0.2 authenticated smoke test');
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});
