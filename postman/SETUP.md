# Postman Setup for B2W EST and OPS APIs

This guide gets both APIs connected quickly and safely.

Before starting, review `API_CREDENTIALS.md` in the repository root so you know which credentials belong in `.env`, which ones are optional, and how they map into Postman variable names.

## 1. Import assets

1. Import collection: `postman/collections/B2W Est API Integration/.resources/definition.yaml`
2. Import collection: `postman/collections/B2W Ops API Integration/.resources/definition.yaml`
3. Import environment: `postman/environments/B2W Est API.environment.yaml`
4. Import environment: `postman/environments/B2W Ops API.environment.yaml`

## 2. Configure environment variables

Set values in Postman Environment **Current Value** fields (do not commit real secrets).

If you are keeping local values in `.env`, map them into Postman like this:

### `.env` to Postman naming

- `OPS_BASE_URL` -> `BaseURL`
- `OPS_CONNECTION_STRING` -> `ConnectionString`
- `OPS_USERNAME` -> `UserName`
- `OPS_PASSWORD` -> `Password`
- `OPS_CLIENT_ID` -> `ClientID`
- `OPS_CLIENT_SECRET` -> `ClientSecret`
- `EST_BASE_URL` -> `BaseURL`
- `EST_CONNECTION_STRING` -> `ConnectionString`
- `EST_USERNAME` -> `UserName`
- `EST_PASSWORD` -> `Password`
- `EST_CLIENT_ID` -> `ClientID`
- `EST_CLIENT_SECRET` -> `ClientSecret`

### EST environment

- `BaseURL`: EST API host URL (example: `https://est-api.company.local`)
- `ConnectionString`: if your EST login requires it, otherwise leave blank
- `UserName`: EST login user name when login uses account credentials
- `Password`: EST login password when login uses account credentials
- `ClientID`: EST client credential ID used for request authorization/header security
- `ClientSecret`: EST client credential secret used for request authorization/header security
- `Token`: leave blank (auto-populated)

### OPS environment

- `BaseURL`: OPS API host URL
- `ConnectionString`: if required by your deployment
- `UserName`: keep populated if your tenant flow or login request still expects it
- `Password`: keep populated if your tenant flow or login request still expects it
- `ClientID`: OPS client credential ID
- `ClientSecret`: OPS client credential secret
- `LoginMode`: use `client`
- `Token`: leave blank (auto-populated)

In this project, keep client credentials populated and also keep username/password available when the login flow still depends on them.

## 3. Smoke test connectivity

1. Select EST environment and run `Ping` in EST collection.
2. Select OPS environment and run `Ping` (or simplest public endpoint) in OPS collection.
3. If either fails, resolve URL/TLS/network first.

## 4. Validate auth

### EST

1. Run `Login` request in EST collection.
2. Confirm response contains `AccessToken`.
3. Run one GET list endpoint and verify `200`.

Current collection behavior indicates EST login uses `UserName` and `Password`, while `ClientID` and `ClientSecret` may also be attached on subsequent requests when present.

### OPS

OPS setup should keep client credentials populated.

1. Set `ClientID` and `ClientSecret`.
2. Keep `UserName` and `Password` populated too if your environment or explicit login request still relies on them.
3. Set `LoginMode=client` where applicable.
4. Run login or a simple GET endpoint and confirm `200`.

Then run one GET list endpoint and verify `200`.

## 5. Expected runtime behavior

- Collection scripts fetch token before requests and apply bearer auth via `{{Token}}`.
- EST login and request authorization may use different credential fields in combination.
- On `401`, re-run login request and retry endpoint.
- Template environment files in `postman/environments/` should remain free of live secrets.

## 6. Important EST update rule

For EST `PUT` calls:

1. GET the entity first.
2. Keep `AntiTamperToken` exactly as returned.
3. PUT the full entity body.

Skipping this can cause rejected updates or unintended field loss.
