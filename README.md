# B2W Est & Ops Connections
Integration layer connecting B2W Trimble (OpsAPI & EstAPI) with Microsoft 365. Contains API definitions, Postman collections, and Power Automate connector configurations for syncing project data to SharePoint, automating folder creation, and enabling reporting through Power BI. Built for Creel Contracting's estimating and project management workflow.

## Setup Documentation

- API credentials and project notes: `API_CREDENTIALS.md`
- OPS API connection documentation: `Ops-Api/OPS_API.md`
- Postman setup: `postman/SETUP.md`
- Optional later-phase Vercel setup: `VERCEL_SETUP.md`

## Recommended Setup Order

1. Review `API_CREDENTIALS.md` to understand which values are required and where they belong.
2. Complete Postman verification using `postman/SETUP.md`.
3. Only after API auth and test calls succeed should you move on to `VERCEL_SETUP.md` or any application-layer work.

## Environment Variables

Use `.env.example` as the template for required variables. Keep real values in local or hosted secret stores only (for example local `.env` or Vercel project environment variables).

## Project Layout

- `postman/collections/`: request definitions for OPS and EST API testing
- `postman/environments/`: importable Postman environment templates
- `Est-Api/`: EST API reference/spec files
- `Ops-Api/`: OPS API reference/spec files
- `.env.example`: safe template of required local variables
