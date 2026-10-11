# Pioneer Admin

Administration frontend for Pioneer Legacy Works.

This repository is intentionally frontend-only. Shared application data, authentication, authorization, company isolation, bookkeeping logic, and other business rules belong in `Pioneer-Backend`.

## Payroll — first-party employee earnings engine

Pioneer Admin has a dedicated Payroll workspace at
`https://admin.pioneerlegacyworks.com/payroll`.

- **Hours & Timesheets** — manager corrections and approved timekeeping
- **Pay Registers** — regular/overtime gross wages and Books accruals
- **Tax Withholding** — Pioneer-only v0.4.4 2026 withholding estimates from
  verified signed W-4/IT-4 elections, prior wages, Ohio/Toledo rules and FICA
- **Native Payroll** — Pioneer-only v0.4.3 calculation previews: regular wages,
  estimated overtime, posted wage corrections, expense reimbursements and
  separately recorded authorized voluntary deductions
- **Pay Rates** — effective-dated employee hourly wages
- **Adjustments** — posted bonuses, retroactive corrections and reimbursements
- **Labor Costs / Books Accounts** — reviewed job-linked wage costs
- **Payroll Provider (Legacy)** — optional prior CSV handoff/export only

Withholding estimates have their own **draft → approved** review and
immutable tax evidence. Approval is not final net pay, employer tax filing,
bank payment, or authorization to disburse. The 2026 rules currently support
Ohio-resident employees doing only Toledo-taxable work, weekly/biweekly payroll
with actual paydays in Aug–Dec 2026, and manually verified school districts
(none, traditional or earned-income base).

The native preview flow is **draft → approved** with a source-integrity check.
A stale draft must be voided with a reason and recalculated. Approved snapshots
are immutable and employee-only previews appear in Pioneer Employees → My Pay.

**The v0.4.3 earnings engine remains separate from v0.4.4 withholding estimates.**
v0.4.4 now previews federal, Ohio, Toledo and eligible school district withholding,
plus employee/employer FICA, using verified tax elections and prior wages.
Ohio's 2026 supplemental compensation (bonuses and retroactive pay) uses the
separate 2.75% withholding rate, rather than the regular wage withholding formula.
Nonzero wage corrections require independent classification review.

**Neither v0.4.3 nor v0.4.4 authorizes wage payment, tax remittance or filing.**
Projected net amounts are review-only. Documented effective FUTA and assigned total Ohio UI rates now calculate
employer unemployment costs separately from employee deductions. Other employer
obligations, actual pay statements, deposits and returns remain incomplete. All access controls and calculations
are enforced in the shared Pioneer Backend, not in the frontend.

## Stack

- React
- Vite
- React Router
- Shared backend API client using `VITE_API_BASE_URL`

## Local development

1. Install dependencies:

   `npm install`

2. Copy `.env.example` to `.env` and set the backend URL if needed.

3. Start the development server:

   `npm run dev`

## Environment

`VITE_API_BASE_URL` points to the shared Pioneer backend. API routes are consumed directly without URL-path API versioning.

Example:

`VITE_API_BASE_URL=http://localhost:3000`

## Initial application areas

- Dashboard
- Companies
- Users
- System

These routes currently provide the application shell and will be implemented against the shared backend as backend capabilities are added.

## Payday and employer-tax controls

Tax Withholding now requires the actual payday, signed-form elections, and prior
SS/Medicare/FUTA/Ohio UI wages paid by the same legal employer before that payment.
Do not include another employer’s wages. Effective elections are selected by payday.
Federal exempt claims require 2026 documentation; additional Ohio withholding and
traditional-base school-district exemptions are supported.

Enter the assigned **total** Ohio UI rate (including notice fees) and verified
effective FUTA rate with an evidence reference. No rate or credit is prefilled.
Wage-history corrections append new evidence and make drafts stale. Older drafts
must be voided and recalculated with a payday; approved historical records are
preserved. This does not make the application ready to disburse payroll. The
backend `docs/PAYROLL_READINESS.md` records the remaining gross-pay, paid-wage,
pay-statement and filing requirements.

### Payments & Statements

`/payroll/payments` records completed external payments against approved withholding.
Enter actual date/net, independently checked gross, statement address and evidence;
download and deliver the printable HTML statement. No transfers or Books settlement
are initiated. Duplicate payments are blocked. Full void/return records remain in
history; reversed payroll cannot be reissued through this screen.

Year/quarter worksheets and CSV export contain this business's recorded payments,
not external/manual opening wages or official returns. Reversed CSV rows are labeled
and excluded from totals. External tax activity records retain agency filing/payment
confirmations; Pioneer does not file/remit. Employee-portal display, automatic paid-YTD
withholding, official returns, corrections/reissue and Books reconciliation remain.
