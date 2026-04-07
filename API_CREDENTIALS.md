# API Credentials Setup

This document explains which credentials this project expects, where to store them, and how they map into Postman and future app code.

## Purpose

This repository currently acts as an integration workspace for:

- B2W OPS API
- B2W EST API
- Postman collections and environments
- API reference/spec files

The repository does not store live credentials in source control. Real values belong in local `.env` files, Postman Current Values, or a deployment secret store.

## Files that matter

- `.env.example`: safe template showing the variable names the project expects
- `.env`: your local secret values for development only
- `postman/SETUP.md`: steps for configuring Postman environments and validating connectivity
- `postman/environments/`: YAML environment templates for Postman

## OPS credentials

### Commonly used

- `OPS_BASE_URL`
- `OPS_CLIENT_ID`
- `OPS_CLIENT_SECRET`

### Sometimes required depending on tenant setup

- `OPS_CONNECTION_STRING`

### Keep available when the login flow or request templates expect them

- `OPS_USERNAME`
- `OPS_PASSWORD`

## EST credentials

### Commonly used

- `EST_BASE_URL`
- `EST_CLIENT_ID`
- `EST_CLIENT_SECRET`

### Sometimes required depending on tenant setup

- `EST_CONNECTION_STRING`

### Keep available when login uses username/password

- `EST_USERNAME`
- `EST_PASSWORD`

## `.env` variable reference

Use `.env.example` as the template.

## Placeholder example values

These are examples only. They are here to show format and intent, not real secrets.

### OPS example

```env
OPS_BASE_URL=https://b2w-eus6.b2w.trimble.com/OPSAPI_YourTenantName
OPS_CLIENT_ID=your-ops-client-id
OPS_CLIENT_SECRET=your-ops-client-secret
OPS_CONNECTION_STRING=Server=your-server,48100;Database=BUILD2WIN_YourTenantName;Integrated Security=SSPI;MultipleActiveResultSets=true;Encrypt=True;TrustServerCertificate=True;
OPS_USERNAME=your-ops-username-if-required
OPS_PASSWORD=your-ops-password-if-required
```

### EST example

```env
EST_BASE_URL=https://b2w-eus6.b2w.trimble.com/ESTAPI_YourTenantName
EST_USERNAME=domain\\username
EST_PASSWORD=your-est-password
EST_CLIENT_ID=your-est-client-id
EST_CLIENT_SECRET=your-est-client-secret
EST_CONNECTION_STRING=Server=your-server,48100;Database=YourTenantName;MultipleActiveResultSets=true;Integrated Security=SSPI
```

### How to read these examples

- Replace `YourTenantName` with the exact tenant identifier used by your B2W environment
- Keep both username/password and client credentials if your collection or tenant flow depends on both
- Leave optional values blank until you confirm they are required

### OPS

- `OPS_BASE_URL`: full tenant-specific OPS API base URL
- `OPS_CLIENT_ID`: client ID used for OPS client authentication
- `OPS_CLIENT_SECRET`: secret paired with the OPS client ID
- `OPS_CONNECTION_STRING`: optional tenant/database header value when your OPS deployment expects it
- `OPS_USERNAME`: keep available if the login request or tenant flow expects a username
- `OPS_PASSWORD`: keep available if the login request or tenant flow expects a password

### EST

- `EST_BASE_URL`: full tenant-specific EST API base URL
- `EST_USERNAME`: username used during EST login in the current Postman collection flow
- `EST_PASSWORD`: password used during EST login in the current Postman collection flow
- `EST_CLIENT_ID`: client ID used for EST request authorization/header security
- `EST_CLIENT_SECRET`: secret paired with the EST client ID
- `EST_CONNECTION_STRING`: only when EST login or requests require it

## Postman variable mapping

The Postman environments use different variable names than `.env`.

### OPS mapping

- `.env` `OPS_BASE_URL` -> Postman `BaseURL`
- `.env` `OPS_CONNECTION_STRING` -> Postman `ConnectionString`
- `.env` `OPS_USERNAME` -> Postman `UserName`
- `.env` `OPS_PASSWORD` -> Postman `Password`
- `.env` `OPS_CLIENT_ID` -> Postman `ClientID`
- `.env` `OPS_CLIENT_SECRET` -> Postman `ClientSecret`
- Postman `Token` is runtime-generated and should be left blank before login

### EST mapping

- `.env` `EST_BASE_URL` -> Postman `BaseURL`
- `.env` `EST_CONNECTION_STRING` -> Postman `ConnectionString`
- `.env` `EST_USERNAME` -> Postman `UserName`
- `.env` `EST_PASSWORD` -> Postman `Password`
- `.env` `EST_CLIENT_ID` -> Postman `ClientID`
- `.env` `EST_CLIENT_SECRET` -> Postman `ClientSecret`
- Postman `Token` is runtime-generated and should be left blank before login

## What the current collection files indicate

Based on the checked-in Postman assets:

- EST collection pre-request auth logs in with `UserName` and `Password`
- EST requests may also attach `ClientID` and `ClientSecret` headers after login when values are present
- OPS collection pre-request auth currently requests a token with `ClientID` and `ClientSecret`
- OPS login request template still includes `UserName` and `Password`

That means the safest documentation for this repo is: keep both user/password and client credentials available unless you deliberately simplify the collection behavior later.

## Recommended OPS setup

If OPS is already working for you in Postman, your safest default is:

1. Put OPS values into local `.env`
2. Copy the same values into Postman Current Values
3. Keep `ClientID` and `ClientSecret` populated
4. Keep `UserName` and `Password` populated if your login request or tenant flow still expects them
5. Leave token fields blank so Postman scripts can populate them

### SH Creel-style example pattern

Your current OPS values appear to follow this pattern:

- Base URL uses a tenant-specific path such as `OPSAPI_SHCreelContracting`
- Connection string may point to a `BUILD2WIN_<TenantName>` database for OPS
- Client ID and client secret are the primary login path when Postman works in client mode

## Recommended EST setup

1. Put EST values into local `.env`
2. Copy the same values into Postman Current Values
3. Keep `UserName` and `Password` populated for EST login
4. Keep `ClientID` and `ClientSecret` populated for request authorization/header security
5. Preserve `AntiTamperToken` on EST `PUT` updates

### SH Creel-style example pattern

Your current EST values appear to follow this pattern:

- Base URL uses a tenant-specific path such as `ESTAPI_SHCreelContracting`
- Connection string may point to the tenant database name without the OPS `BUILD2WIN_` prefix
- EST login can use username/password while client ID and client secret are still kept for authorization behavior after login

## Security rules for this repo

- Do not commit `.env`
- Do not commit real secrets into Postman environment exports
- Do not place secrets in README files or request examples
- Prefer `.env.example` for documenting variable names only
- Rotate any credential that was copied into a tracked file by mistake

## Short glossary

- `BaseURL`: the root URL for a tenant-specific API, used as the starting point for all requests. Example: `https://b2w-eus6.b2w.trimble.com/OPSAPI_SHCreelContracting`
- `ConnectionString`: a tenant/database identifier string required by some OPS or EST deployments. Example: `Server=b2w-eus6-PIRS,48100;Database=BUILD2WIN_SHCreelContracting;Integrated Security=SSPI;MultipleActiveResultSets=true;Encrypt=True;TrustServerCertificate=True;`
- `ClientID`: the public identifier for an application credential pair. Example: a long app-issued string provided by B2W admin or Trimble configuration
- `ClientSecret`: the private secret paired with a client ID. Example: another long secret string that should only live in local secrets or secure settings
- `UserName`: the login name used when the collection or login request expects user-based auth. Example: `domain\\jdoe` or `jdoe`, depending on environment
- `Password`: the password paired with `UserName` when login uses a user account. Example: your EST or OPS account password
- `Token`: the bearer token returned after login and used on authenticated API requests. Example request header: `Authorization: Bearer eyJhbGciOi...`
- `LoginMode`: the OPS Postman setting that chooses which authentication path to try. Example: `client` when token acquisition uses client credentials.
- `AntiTamperToken`: a value returned by EST on reads that must be sent back unchanged on many `PUT` updates. Example: `BGu2MtwPn0COEKpvXPD8bg==_QlNK_AF9+Exczywg=`
- `Current Value`: the secret/local-only value field in Postman environments that should hold live credentials instead of committed defaults. Example: put your real `ClientSecret` in Current Value and leave exported/shared defaults blank
- `.env`: local development file containing real environment values and secrets; should not be committed. Example entry: `OPS_CLIENT_ID=your-real-client-id`
- `.env.example`: committed template file that documents variable names without real secret values. Example entry: `OPS_CLIENT_ID=`

## Practical examples

### Example OPS Postman Current Values

If OPS is working in client mode, your Postman environment would typically look like this:

- `BaseURL` = `https://b2w-eus6.b2w.trimble.com/OPSAPI_SHCreelContracting`
- `ConnectionString` = `Server=b2w-eus6-PIRS,48100;Database=BUILD2WIN_SHCreelContracting;Integrated Security=SSPI;MultipleActiveResultSets=true;Encrypt=True;TrustServerCertificate=True;`
- `UserName` = your real username if your login request still expects it
- `Password` = your real password if your login request still expects it
- `ClientID` = your real client ID
- `ClientSecret` = your real client secret
- `LoginMode` = `client`
- `Token` = blank before login

### Example EST Postman Current Values

If EST login uses username/password and requests also depend on client headers, your Postman environment would typically look like this:

- `BaseURL` = `https://b2w-eus6.b2w.trimble.com/ESTAPI_SHCreelContracting`
- `ConnectionString` = `Server=b2w-eus6-PIRS,48100;Database=SHCreelContracting;MultipleActiveResultSets=true;Integrated Security=SSPI`
- `UserName` = `domain\\username`
- `Password` = your real password
- `ClientID` = your real client ID
- `ClientSecret` = your real client secret
- `Token` = blank before login

### Example request usage

When a request is executed successfully, values are typically used like this:

- URL: `{{BaseURL}}/Job`
- Header: `ConnectionString: {{ConnectionString}}`
- Header after login: `Authorization: Bearer {{Token}}`

For EST updates, a request body commonly includes the original anti-tamper value, for example:

```json
{
	"AntiTamperToken": "BGu2MtwPn0COEKpvXPD8bg==_QlNK_AF9+Exczywg=",
	"ObjectID": "32b66b04-0fdc-409f-8e10-aa6f5cf0fc6e"
}
```

## Project notes

### `postman/collections/`

Human-edited request definitions for OPS and EST testing.

### `postman/environments/`

Template environment files for Postman imports. These should not contain live secrets.

### `Est-Api/` and `Ops-Api/`

Reference API definition files used for understanding endpoints and shaping requests.

### `.env.example`

Project-wide variable template. This is the source of truth for which secrets/config values the project expects developers to provide locally.

## First-time setup checklist

1. Copy `.env.example` to `.env`
2. Fill in OPS values
3. Fill in EST values if needed for your work
4. Import Postman collections and environments
5. Copy `.env` values into Postman Current Values
6. Run OPS login and one GET endpoint
7. Run EST login and one GET endpoint if EST work is needed