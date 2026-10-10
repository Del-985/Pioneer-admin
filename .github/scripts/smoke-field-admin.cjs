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
 let providerPhase=null,providerSubmissions=0,providerImports=0,providerRef=null;
 let providerRows=[];
 const providerBatchId='88888811-1111-4111-8111-111111111111';
 const providerDetails=()=>({
   id:providerBatchId,runId:payrollId,providerName:'Example Payroll Provider',
   status:providerPhase,externalReference:providerRef,
   submittedOn:providerRef?'2026-10-10':null,
   expectedEmployeeCount:1,sourceGrossCents:13500,
   providerGrossCents:providerRows.length?providerRows[0].grossCents:null,
   providerNetCents:providerRows.length?providerRows[0].netCents:null,
   providerDeductionsCents:providerRows.length?
     providerRows[0].grossCents-providerRows[0].netCents:null,
   periodStart:'2026-09-28',periodEnd:'2026-10-05',
   sourceLines:[{employeeId:employee,employeeName:'Worker One',
     regularSeconds:13500,overtimeSeconds:0,
     regularCents:13500,overtimeCents:0,grossCents:13500}],
   results:providerRows.map(x=>({...x,employeeName:'Worker One'})),
   events:[{action:'prepared',createdAt:'2026-10-09T00:00:00Z'}],
 });
 let rateHourlyCents=3600,rateEffectiveOn='2026-09-28';
 let adjustmentId=0,adjustmentPosted=0,adjustmentReversed=0;
 const adjustmentList=[];
 const makeAdjustment=(data)=>({
   id:'a000000'+String(++adjustmentId)+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   employeeId:employee,employeeName:'Worker One',
   category:data.category,amountCents:data.amountCents,
   serviceDate:data.serviceDate,description:data.description,
   sourcePayrollRunId:data.sourcePayrollRunId,
   status:'draft',reversesAdjustmentId:null,reversedById:null,journalEntryId:null,
 });
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
     if(request.method()==='POST'){
       const input=JSON.parse(request.postData()||'{}');
       if(input.employeeId!==employee)throw new Error('Wrong employee in hourly rate save');
       rateSaves++;rateHourlyCents=input.hourlyCents;rateEffectiveOn=input.effectiveOn;
     }
     response={data:rateSaves?[{id:'rate',employeeId:employee,employeeName:'Worker One',
       effectiveOn:rateEffectiveOn,hourlyCents:rateHourlyCents,overtimeMultiplierBps:15000}]:[]};
   }
   else if(path.endsWith('/payroll/accounts')){
     response={data:[{id:expenseId,code:'6200',name:'Gross Wage Expense',type:'expense',suggested:true},
       {id:liabilityId,code:'2150',name:'Gross Wages Payable',type:'liability',suggested:true},
       {id:'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',code:'6210',name:'Employee Reimbursement Expenses',type:'expense',suggested:true},
       {id:'ccccccc1-cccc-4ccc-8ccc-cccccccccccc',code:'2160',name:'Employee Reimbursements Payable',type:'liability',suggested:true}]};
   }
   else if(path.endsWith('/payroll/labor-costs'))response={data:[]};
   else if(path.endsWith('/payroll/provider-batches'))
     response={data:providerPhase?[providerDetails()]:[]};
   else if(path.endsWith('/payroll/runs/'+payrollId+'/provider/prepare')){
     providerPhase='prepared';response={data:providerDetails()};
   }
   else if(path.endsWith('/payroll/runs/'+payrollId+'/provider/export')){
     await route.fulfill({status:200,headers:{...headers,'content-type':'text/csv; charset=utf-8'},
       body:'"employeeId","regularSeconds"\r\n"'+employee+'","13500"\r\n'});
     return;
   }
   else if(path.endsWith('/payroll/runs/'+payrollId+'/provider/submitted')){
     const posted=JSON.parse(request.postData()||'{}');
     if(providerRef)throw new Error('Duplicate external provider submission');
     providerSubmissions++;providerRef=posted.externalReference;
     providerPhase='submitted';response={data:providerDetails()};
   }
   else if(path.endsWith('/payroll/runs/'+payrollId+'/provider/import')){
     const posted=JSON.parse(request.postData()||'{}');
     providerImports++;providerRows=posted.rows;
     providerPhase='imported';response={data:providerDetails()};
   }
   else if(path.endsWith('/payroll/runs/'+payrollId+'/provider'))
     response={data:providerDetails()};

   else if(path.endsWith('/payroll/adjustments')){
     if(request.method()==='POST'){
       const details=JSON.parse(request.postData()||'{}');
       const x=makeAdjustment(details);adjustmentList.unshift(x);
       response={data:x};
     }else response={data:adjustmentList};
   }
   else if(path.includes('/payroll/adjustments/')){
     const segments=path.split('/');
     const action=segments.at(-1);
     const id=segments.at(-2);
     const row=adjustmentList.find(x=>x.id===id);
     if(action==='approve'&&row){row.status='approved';response={data:{id,status:'approved'}};}
     else if(action==='post'&&row){
       row.status='posted';row.journalEntryId='d0000001-dddd-4ddd-8ddd-dddddddddddd';
       adjustmentPosted++;response={data:{id,status:'posted',journalEntryId:row.journalEntryId}};
     }else if(action==='reverse'&&row){
       const input=JSON.parse(request.postData()||'{}');
       const rev=makeAdjustment({...row,amountCents:-row.amountCents,
         description:input.reason});
       rev.status='posted';rev.reversesAdjustmentId=row.id;
       row.reversedById=rev.id;adjustmentList.unshift(rev);
       adjustmentReversed++;response={data:rev};
     }else if(action==='events')response={data:[{action:'created',createdAt:'2026-10-09T00:00:00Z',detail:{}}]};
     else if(action==='void'&&row){row.status='void';response={data:{id,status:'void'}};}
   }

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
  if(await page.getByRole('tab',{name:'Hours & Timesheets'}).count())
    throw new Error('Field Operations still contains the retired Hours tab');
  if(await page.getByRole('tab',{name:'Payroll & Books'}).count())
    throw new Error('Field Operations still contains the retired Payroll tab');
  await page.getByRole('link',{name:'Payroll',exact:true}).click();
  await page.getByRole('heading',{name:'Payroll',exact:true}).waitFor({timeout:10000});
  await page.getByRole('link',{name:'Hours & Timesheets'}).waitFor({timeout:10000});
  if(!page.url().includes('/payroll/hours'))
    throw new Error('Payroll sidebar did not open the Hours workspace');
  console.log('PASS: Payroll has its own sidebar navigation and separate Hours section');
  await page.getByText('Worked:',{exact:false}).first().waitFor({timeout:10000});
  await page.getByRole('button',{name:'Approve Hours'}).click();
  await page.getByText('Hours approved.').waitFor({timeout:10000});
  if(timeApprovals!==1)throw new Error('Manager approval did not reach the time API');
  console.log('PASS: Manager reviewed and approved timesheet hours');

  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('link',{name:'Pay Registers'}).click();
  await page.getByRole('heading',{name:'Payroll & Pioneer Books'}).waitFor({timeout:10000});
  await page.getByRole('link',{name:'Pay Rates',exact:true}).click();
  await page.getByRole('combobox',{name:'Employee',exact:true}).selectOption(employee);
  await page.getByRole('spinbutton',{name:'Hourly Rate ($)'}).fill('36');
  await page.getByRole('button',{name:'Save Hourly Rate'}).click();
  await page.getByText('Rate update completed.').waitFor({timeout:10000});
  if(rateSaves!==1)throw new Error('Missing hourly pay-rate request');
  await page.getByRole('link',{name:'Pay Registers'}).click();
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
  await page.getByRole('link',{name:'Payroll Provider'}).click();
  await page.getByRole('heading',{name:'Payroll Provider Handoff'}).waitFor({timeout:10000});
  await page.getByRole('combobox',{name:'Provider payroll register'}).selectOption(payrollId);
  await page.getByRole('textbox',{name:'Provider Name'}).fill('Example Payroll Provider');
  await page.getByRole('button',{name:'Prepare Provider Export'}).click();
  await page.getByText('Provider export prepared completed.').waitFor({timeout:10000});
  const firstDownload=page.waitForEvent('download',{timeout:10000});
  await page.getByRole('button',{name:'Download Approved Hours & Gross CSV'}).click();
  const exported=await firstDownload;
  if(!exported.suggestedFilename().includes('pioneer-payroll-provider'))
    throw new Error('Provider payroll export CSV was not downloaded');
  await page.getByRole('textbox',{name:'Provider Reference'}).fill('EXTERNAL-PAY-001');
  await page.getByRole('button',{name:'Mark Externally Submitted'}).click();
  await page.getByText('External submission recorded completed.').waitFor({timeout:10000});
  if(providerSubmissions!==1||providerRef!=='EXTERNAL-PAY-001')
    throw new Error('External provider submission was not recorded exactly once');
  const templateDownload=page.waitForEvent('download',{timeout:10000});
  await page.getByRole('button',{name:'Download Results CSV Template'}).click();
  await templateDownload;
  const providerCSV=[
    'employeeId,grossCents,federalWithholdingCents,stateWithholdingCents,socialSecurityCents,medicareCents,otherDeductionsCents,netCents,paymentStatus,paidOn,statementReference',
    employee+',13500,1000,500,800,200,0,11000,paid,2026-10-10,STATEMENT-001',
  ].join('\r\n');
  await page.getByLabel('Completed Provider Results CSV').setInputFiles({
    name:'external-results.csv',mimeType:'text/csv',buffer:Buffer.from(providerCSV),
  });
  await page.getByText('Provider Results Preview',{exact:false}).waitFor({timeout:10000});
  await page.getByText('$110.00',{exact:true}).first().waitFor({timeout:10000});
  await page.getByText('I verified these figures against an actual external payroll provider report.',{exact:false}).click();
  await page.getByRole('button',{name:'Import Provider Results Once'}).click();
  await page.getByText('Provider results imported completed.').waitFor({timeout:10000});
  if(providerImports!==1||providerRows.length!==1||providerRows[0].netCents!==11000)
    throw new Error('Provider CSV was not imported with correct withheld and net amounts');
  await page.getByText('Books reconciliation pending.',{exact:false}).waitFor({timeout:10000});
  console.log('PASS: external payroll CSV export, submission reference, final results import and no Books settlement');

  await page.getByRole('link',{name:'Adjustments'}).click();
  await page.getByRole('heading',{name:'Create Payroll Adjustment'}).waitFor({timeout:10000});
  await page.locator('.payroll-adjustment-form select').nth(0).selectOption(employee);
  await page.locator('.payroll-adjustment-form select').nth(1).selectOption('bonus');
  await page.locator('.payroll-adjustment-form input[type=number]').fill('50.00');
  await page.locator('.payroll-adjustment-form textarea').fill('Bonus for completing overnight snow work');
  await page.getByRole('button',{name:'Create Draft Adjustment'}).click();
  await page.getByText('Adjustment created completed.').waitFor({timeout:10000});
  await page.getByRole('button',{name:'Approve Adjustment'}).click();
  await page.getByText('Adjustment approved completed.').waitFor({timeout:10000});
  await page.getByRole('button',{name:'Post to Pioneer Books'}).click();
  await page.getByText('Adjustment posted completed.').waitFor({timeout:10000});
  if(adjustmentPosted!==1)throw new Error('Bonus was not posted');
  await page.getByRole('button',{name:'Reverse Posted Adjustment'}).click();
  await page.getByPlaceholder('Why is this posted adjustment being reversed?').fill(
    'Manager approved reversal due to duplicate compensation');
  await page.getByRole('button',{name:'Create Reversal Journal'}).click();
  await page.getByText('Adjustment reversed completed.').waitFor({timeout:10000});
  if(adjustmentReversed!==1)throw new Error('Adjustment reversal failed');
  console.log('PASS: Admin adjustment create, approve, wage accrual and append-only reversal');

  await page.getByRole('link',{name:'Employees',exact:true}).click();
  await page.getByRole('heading',{name:'Employees',exact:true}).waitFor({timeout:10000});
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('heading',{name:'Hourly Pay Rate — Worker One'}).waitFor({timeout:10000});
  await page.getByText('$36.00/hr',{exact:true}).first().waitFor({timeout:10000});
  await page.getByRole('spinbutton',{name:'Employee hourly rate'}).fill('23.75');
  await page.getByRole('button',{name:'Save Hourly Rate'}).click();
  await page.getByText("Worker One's hourly rate saved.",{exact:true}).waitFor({timeout:10000});
  await page.getByRole('heading',{name:'Hourly Pay Rate — Worker One'}).waitFor({state:'hidden',timeout:10000});
  await page.getByRole('heading',{name:'Edit employee'}).waitFor({state:'hidden',timeout:10000});
  if(rateSaves!==2||rateHourlyCents!==2375)
    throw new Error('Admin employee profile failed to save the selected hourly wage');
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('heading',{name:'Hourly Pay Rate — Worker One'}).waitFor({timeout:10000});
  await page.getByText('$23.75/hr',{exact:true}).first().waitFor({timeout:10000});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('heading',{name:'Hourly Pay Rate — Worker One'}).waitFor({state:'hidden',timeout:10000});
  console.log('PASS: Admin profile rate persists after save, but the editor closes and can reopen');
  await page.getByRole('link',{name:'Payroll',exact:true}).click();
  await page.getByRole('link',{name:'Labor Costs'}).click();
  await page.getByRole('heading',{name:'Recorded Gross Labor by Job'}).waitFor({timeout:10000});
  await page.getByRole('link',{name:'Books Accounts'}).click();
  await page.getByRole('heading',{name:'Gross Wage Accounting'}).waitFor({timeout:10000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Payroll',exact:true}).waitFor({timeout:10000});
  await page.getByRole('heading',{name:'Gross Wage Accounting'}).waitFor({timeout:10000});
  if(!page.url().endsWith('/payroll/accounts'))
    throw new Error('Payroll section URL was not retained across reload');
  console.log('PASS: Payroll labor and Books account sections have reloadable deep links');


  if(errors.length)throw new Error('Uncaught errors: '+errors.join('\n'));
  console.log('PASS: Admin field v0.2 authenticated smoke test');
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});
