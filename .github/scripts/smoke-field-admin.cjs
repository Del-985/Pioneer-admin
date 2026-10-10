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
  let approvals=0,shiftCreates=0,routeCreates=0,timeApprovals=0;
 let timeEntryStatus='submitted';
 let payrollStatus=null,rateSaves=0,payrollPosts=0,payrollApprovals=0,payrollCreates=0;
 const payrollId='77777777-7777-4777-8777-777777777777';
 const expenseId='88888888-8888-4888-8888-888888888888';
 const liabilityId='99999999-9999-4999-8999-999999999999';
 const currentPayroll=()=>({
   id:payrollId,businessUnitId:bu,status:payrollStatus,periodStart:'2026-09-28',
   periodEnd:'2026-10-05',grossCents:13500,regularSeconds:13500,
   overtimeSeconds:0,expenseAccountId:expenseId,payableAccountId:liabilityId,
   journalEntryId:payrollStatus==='posted'?'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa':null,
   employees:[{employeeId:employee,employeeName:'Worker One',regularSeconds:13500,
     overtimeSeconds:0,grossCents:13500}],
   lines:[{id:'bbbbaaaa-bbbb-4bbb-8bbb-bbbbbbbbbbbb',employeeId:employee,
     employeeName:'Worker One',timeEntryId:'66666666-6666-4666-8666-666666666666',
     clockInAt:'2026-10-09T22:00:00Z',clockOutAt:'2026-10-10T02:00:00Z',
     hourlyCents:3600,regularSeconds:13500,overtimeSeconds:0,
     regularCents:13500,overtimeCents:0,grossCents:13500}],
 });
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
   else if(path.endsWith('/payroll/rates')){
     if(request.method()==='POST')rateSaves++;
     response={data:rateSaves?[{id:'rate',employeeId:employee,employeeName:'Worker One',
       effectiveOn:'2026-09-28',hourlyCents:3600,overtimeMultiplierBps:15000}]:[]};
   }
   else if(path.endsWith('/payroll/accounts')){
     response={data:[{id:expenseId,code:'6200',name:'Gross Wage Expense',type:'expense',suggested:true},
       {id:liabilityId,code:'2150',name:'Gross Wages Payable',type:'liability',suggested:true}]};
   }
   else if(path.endsWith('/payroll/labor-costs'))response={data:[]};
   else if(path.endsWith('/payroll/runs')){
     if(request.method()==='POST'){payrollCreates++;payrollStatus='draft';
       response={data:{id:payrollId,status:'draft',grossCents:13500,lineCount:1}};}
     else response={data:payrollStatus?[currentPayroll()]:[]};
   }
   else if(path.endsWith('/payroll/runs/'+payrollId))response={data:currentPayroll()};
   else if(path.endsWith('/payroll/runs/'+payrollId+'/approve')){
     payrollApprovals++;payrollStatus='approved';response={data:{id:payrollId,status:'approved'}};
   }
   else if(path.endsWith('/payroll/runs/'+payrollId+'/post')){
     payrollPosts++;payrollStatus='posted';response={data:{id:payrollId,status:'posted',
       grossCents:13500,journalEntryId:currentPayroll().journalEntryId}};
   }

   else if(path.endsWith('/field/shifts')){
     if(request.method()==='POST')shiftCreates++;
     response={data:[]};
   }else if(path.endsWith('/field/routes')){
     if(request.method()==='POST')routeCreates++;
     response={data:[]};
   }else if(path.endsWith('/field/time')){
     const entry={id:'66666666-6666-4666-8666-666666666666',
       employeeId:employee,employeeName:'Worker One',
       clockInAt:'2026-10-09T22:00:00.000Z',
       clockOutAt:'2026-10-10T02:00:00.000Z',
       reviewStatus:timeEntryStatus,reviewNotes:null,correctedAt:null,
       paidBreakSeconds:0,unpaidBreakSeconds:900,workedSeconds:13500,
       workedHours:3.75,missedClockOut:false,isOpen:false};
     response={data:{weekStart:'2026-10-05',timeZone:'America/Detroit',
       entries:[entry],summary:{totalHours:3.75,approvedHours:timeEntryStatus==='approved'?3.75:0,
         pendingHours:timeEntryStatus==='approved'?0:3.75},
       employeeSummaries:[{employeeId:employee,employeeName:'Worker One',
         totalHours:3.75,approvedHours:timeEntryStatus==='approved'?3.75:0,
         pendingHours:timeEntryStatus==='approved'?0:3.75,pendingCount:timeEntryStatus==='approved'?0:1}],
       missedClockOuts:[]}};
   }else if(path.includes('/field/time/entries/')&&path.endsWith('/review')){
     timeApprovals++;
     const values=JSON.parse(request.postData()||'{}');
     if(values.decision!=='approve')throw new Error('Unexpected review decision');
     timeEntryStatus='approved';response={data:{id:'66666666-6666-4666-8666-666666666666',reviewStatus:'approved'}};
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
  await page.getByRole('tab',{name:'Hours & Timesheets'}).click();
  await page.getByText('Worked:',{exact:false}).first().waitFor({timeout:10000});
  await page.getByRole('button',{name:'Approve Hours'}).click();
  await page.getByText('Hours approved.').waitFor({timeout:10000});
  if(timeApprovals!==1)throw new Error('Manager approval did not reach the time API');
  console.log('PASS: Manager reviewed and approved timesheet hours');

  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('tab',{name:'Payroll & Books'}).click();
  await page.getByRole('heading',{name:'Payroll & Pioneer Books'}).waitFor({timeout:10000});
  await page.getByRole('tab',{name:'Employee Pay Rates'}).click();
  await page.getByRole('combobox',{name:'Employee',exact:true}).selectOption(employee);
  await page.getByRole('spinbutton',{name:'Hourly Rate ($)'}).fill('36');
  await page.getByRole('button',{name:'Save Hourly Rate'}).click();
  await page.getByText('Rate update completed.').waitFor({timeout:10000});
  if(rateSaves!==1)throw new Error('Missing hourly pay-rate request');
  await page.getByRole('tab',{name:'Pay Periods & Registers'}).click();
  await page.getByRole('button',{name:'Prepare Draft Register'}).click();
  await page.getByText('Payroll draft completed.').waitFor({timeout:10000});
  if(payrollCreates!==1)throw new Error('No draft payroll register created');
  await page.getByRole('button',{name:'Approve Register'}).click();
  await page.getByText('Payroll approval completed.').waitFor({timeout:10000});
  if(payrollApprovals!==1)throw new Error('Manager did not approve payroll');
  await page.getByRole('button',{name:'Post Unpaid Wages to Books'}).click();
  await page.getByText('Books payroll posting completed.').waitFor({timeout:10000});
  if(payrollPosts!==1)throw new Error('Payroll journal was not posted');
  console.log('PASS: Admin payroll rate, register approval and unpaid wage posting');
  if(errors.length)throw new Error('Uncaught errors: '+errors.join('\n'));
  console.log('PASS: Admin field v0.2 authenticated smoke test');
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});
