# Vercel Setup Guide

This is an optional later-phase guide. Do not start here.

This repository currently contains API specs and Postman assets. Vercel deploys runnable app code (for example Next.js), so you need to add an app layer before deployment.

Use this guide only after API credentials are documented and OPS API is confirmed working in Postman.

## What this guide covers

1. Create a deployable app in this repo
2. Add environment variables safely
3. Connect GitHub to Vercel
4. Deploy and smoke test
5. Troubleshoot common issues

## When to use this guide

Use this file only if you decide to add a deployable application layer to this repository.

If you are still working on:

- collecting credentials
- validating OPS or EST in Postman
- understanding the repo structure

stop here and use `API_CREDENTIALS.md` and `postman/SETUP.md` first.

## 1) Prerequisites

- GitHub repository with your latest changes pushed
- A Vercel account
- OPS API credentials already validated in Postman
- Node.js 20+ installed locally
- A decision that this repo should include a web app or server app

## 2) Add a deployable app to this repo

From the repository root, scaffold a Next.js app in a subfolder named `web`:

```bash
npx create-next-app@latest web --typescript --eslint --app --src-dir --import-alias "@/*"
```

Why this step matters:
- Vercel can only build and deploy runnable code.
- The current repo does not yet include an app runtime.
- Postman collections by themselves are not deployable artifacts.

## 3) Configure local environment variables

The root `.env.example` already contains OPS and EST variables.

For local app testing in `web`, create `web/.env.local` and set at least:

```env
OPS_BASE_URL=
OPS_CLIENT_ID=
OPS_CLIENT_SECRET=
OPS_CONNECTION_STRING=
```

Notes:
- Keep real secrets only in `.env.local` and in Vercel project settings.
- Do not commit `.env.local`.

## 4) Add a server route in the app

Create a server-only endpoint in Next.js (for example `web/src/app/api/ops/ping/route.ts`) that:

1. Reads OPS environment variables
2. Authenticates against OPS API
3. Calls a simple OPS endpoint (such as Ping)
4. Returns sanitized JSON for testing

Important:
- Keep OPS calls server-side only.
- Never expose client secret values to browser code.

## 5) Run locally

```bash
cd web
npm install
npm run dev
```

Then test your local endpoint:

- Browser: `http://localhost:3000/api/ops/ping`
- Or Postman/curl against that local URL

## 6) Connect repository to Vercel

1. Open Vercel dashboard
2. Click Add New -> Project
3. Import this GitHub repository
4. Set Root Directory to `web`
5. Framework preset should auto-detect as Next.js

## 7) Set Vercel environment variables

In Vercel Project Settings -> Environment Variables, add:

- `OPS_BASE_URL`
- `OPS_CLIENT_ID`
- `OPS_CLIENT_SECRET`
- `OPS_CONNECTION_STRING` (if your OPS deployment requires it)

Apply variables for at least:
- Production
- Preview (optional but recommended)

## 8) Deploy

After variables are added:

1. Trigger a deployment from Vercel (or push to `main`)
2. Wait for build success
3. Hit deployed endpoint: `/api/ops/ping`
4. Confirm a successful API response

## 9) Common issues and fixes

### Build succeeds but endpoint fails with 401

- Verify `OPS_CLIENT_ID` and `OPS_CLIENT_SECRET` are correct in Vercel
- Confirm auth mode used in code matches your OPS working mode from Postman

### 404 for API endpoint

- Confirm route file exists under Next.js `app/api/.../route.ts`
- Confirm Vercel Root Directory is set to `web`

### Network/TLS errors

- Confirm `OPS_BASE_URL` matches the working Postman URL exactly
- Validate outbound access and TLS trust requirements for your OPS host

### Works locally but not in Vercel

- Compare local `.env.local` values to Vercel environment values
- Ensure all required vars are configured for the target environment

## 10) Recommended workflow for this repo

1. Validate API behavior in Postman first
2. Add/update server endpoint in `web`
3. Test locally
4. Push to GitHub
5. Verify Vercel Preview
6. Promote to Production

## Security checklist

- Keep `.env` and `.env.local` out of source control
- Never print full secrets to logs
- Keep OPS auth calls in server-only code
- Rotate credentials if they were ever exposed
