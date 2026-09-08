# Pioneer Admin

Administration frontend for Pioneer Legacy Works.

This repository is intentionally frontend-only. Shared application data, authentication, authorization, company isolation, bookkeeping logic, and other business rules belong in `Pioneer-Backend`.

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
