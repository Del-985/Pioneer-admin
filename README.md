# Pioneer Admin

Administration frontend for Pioneer Legacy Works.

This repository is intentionally frontend-only. Shared application data, authentication, authorization, company isolation, bookkeeping logic, and other business rules belong in `Pioneer-Backend`.

## Payroll — first-party employee earnings engine

Pioneer Admin has a dedicated Payroll workspace at
`https://admin.pioneerlegacyworks.com/payroll`.

- **Hours & Timesheets** — manager corrections and approved timekeeping
- **Pay Registers** — regular/overtime gross wages and Books accruals
- **Native Payroll** — Pioneer-only v0.4.3 calculation previews: regular wages,
  estimated overtime, posted wage corrections, expense reimbursements and
  separately recorded authorized voluntary deductions
- **Pay Rates** — effective-dated employee hourly wages
- **Adjustments** — posted bonuses, retroactive corrections and reimbursements
- **Labor Costs / Books Accounts** — reviewed job-linked wage costs
- **Payroll Provider (Legacy)** — optional prior CSV handoff/export only

The native preview flow is **draft → approved** with a source-integrity check.
A stale draft must be voided with a reason and recalculated. Approved snapshots
are immutable and employee-only previews appear in Pioneer Employees → My Pay.

**No statutory withholding, employer tax, final net pay, payment or filing is
implemented in v0.4.3.** An approved calculation is **not** approval to pay.
The forthcoming tax engine is v0.4.4. All access controls and calculations
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
