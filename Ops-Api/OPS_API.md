# B2W OPS API — Connection Documentation

This document describes how to connect to and use the B2W Ops API (OpsAPI) for Creel Contracting's operational data. It covers authentication, required headers, endpoint catalogue, OData query usage, error handling, and Postman integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
   - [Client Credentials Login (recommended)](#client-credentials-login-recommended)
   - [Username / Password Login](#username--password-login)
   - [Trimble Identity (TID) Login](#trimble-identity-tid-login)
   - [Using the Bearer Token](#using-the-bearer-token)
4. [Required Request Headers](#required-request-headers)
5. [OData Query Support](#odata-query-support)
6. [Endpoint Catalogue](#endpoint-catalogue)
   - [Utility](#utility)
   - [Authentication](#authentication-endpoints)
   - [Jobs](#jobs)
   - [Equipment](#equipment)
   - [Labor](#labor)
   - [Materials & Parts](#materials--parts)
   - [Personnel](#personnel)
   - [Organization & Reference Data](#organization--reference-data)
   - [Maintenance](#maintenance)
   - [Field Log](#field-log)
   - [Trucking & Transport](#trucking--transport)
   - [External Integrations](#external-integrations)
7. [Common Response Codes](#common-response-codes)
8. [CRUD Patterns](#crud-patterns)
9. [Schema Endpoints](#schema-endpoints)
10. [Postman Collection Usage](#postman-collection-usage)
11. [Environment Variable Reference](#environment-variable-reference)

---

## Overview

OpsAPI is a .NET Core REST API built on B2W Trimble's Operational Suite. It exposes CRUD operations for every major entity in the Ops database through RESTful HTTP endpoints. All endpoints are asynchronous and secured with Bearer Token authorization.

**Key characteristics:**

- All authenticated endpoints require a Bearer Token in the `Authorization` header.
- Paginated list endpoints support OData query options (`$filter`, `$select`, `$orderby`, `$top`, `$skip`).
- A default page size of 100 records applies to all list responses.
- All exceptions are caught server-side; error detail is logged to the server `Logs` folder.
- `ConnectionString` header is required on most endpoints when your deployment expects it.

---

## Base URL

The base URL is tenant-specific. It follows the pattern:

```
https://b2w-eus6.b2w.trimble.com/OPSAPI_<TenantName>
```

**Example for SH Creel Contracting:**

```
https://b2w-eus6.b2w.trimble.com/OPSAPI_SHCreelContracting
```

Store this value in:

- `.env` → `OPS_BASE_URL`
- Postman environment → `BaseURL`

Every request URL in this document is written as `{{BaseURL}}/...`.

---

## Authentication

OpsAPI supports three login methods. All return a JWT whose `AccessToken` field must be sent as a Bearer Token on every subsequent request.

### Client Credentials Login (recommended)

Used when the B2W Ops system is configured in **TID (Trimble Identity)** mode and you want to execute API actions with System Administrator privileges.

**Request**

```
GET {{BaseURL}}/Login
```

**Headers**

| Header         | Value                             |
|----------------|-----------------------------------|
| `clientId`     | `{{ClientID}}`                    |
| `clientSecret` | `{{ClientSecret}}`                |

**Successful response (200)**

```json
{
  "AccessToken": "eyJhbGciOiJSUzI1NiIs...",
  "RefreshToken": "..."
}
```

Store `AccessToken` as the environment variable `Token`. The Postman collection scripts do this automatically.

---

### Username / Password Login

Used when your B2W deployment authenticates through Windows/domain credentials.

**Request**

```
GET {{BaseURL}}/Login
```

**Headers**

| Header       | Value            |
|--------------|------------------|
| `userName`   | `{{UserName}}`   |
| `password`   | `{{Password}}`   |

`UserName` must be the fully qualified domain name (FQDN) matching the `WindowsAccountName` column in the Ops database User table (e.g., `DOMAIN\jdoe`).

---

### Trimble Identity (TID) Login

Used when you have a valid Trimble ID Access Token for a specific user and want API actions attributed to that user.

**Request**

```
GET {{BaseURL}}/LoginWithTID
```

**Headers**

| Header          | Value                          |
|-----------------|--------------------------------|
| `Authorization` | `Bearer <Trimble ID Access Token>` |

The Trimble ID Access Token must be obtained from the Trimble Identity system and must correspond to a B2W Ops user who has previously logged in with that identity.

---

### Using the Bearer Token

After any successful login, attach the `AccessToken` to all subsequent requests:

```
Authorization: Bearer {{Token}}
```

A `401 Unauthorized` response at any point means the token has expired or is invalid. Re-run the login request to get a fresh token.

---

## Required Request Headers

| Header             | When Required                                  | Value                        |
|--------------------|------------------------------------------------|------------------------------|
| `Authorization`    | All authenticated endpoints                    | `Bearer {{Token}}`           |
| `ConnectionString` | Most data endpoints when tenant expects it     | `{{ConnectionString}}`       |
| `clientId`         | Login (client credentials flow only)           | `{{ClientID}}`               |
| `clientSecret`     | Login (client credentials flow only)           | `{{ClientSecret}}`           |
| `userName`         | Login (username/password flow only)            | `{{UserName}}`               |
| `password`         | Login (username/password flow only)            | `{{Password}}`               |
| `ObjectID`         | DELETE requests                                | UUID of entity to delete     |
| `Content-Type`     | POST and PUT requests                          | `application/json`           |

**Example ConnectionString format:**

```
Server=b2w-eus6-PIRS,48100;Database=BUILD2WIN_SHCreelContracting;Integrated Security=SSPI;MultipleActiveResultSets=true;Encrypt=True;TrustServerCertificate=True;
```

---

## OData Query Support

All `GET` list endpoints accept standard OData query parameters as query strings.

| Parameter  | Description                              | Example                                     |
|------------|------------------------------------------|---------------------------------------------|
| `$top`     | Maximum records to return (default 100)  | `$top=50`                                   |
| `$skip`    | Records to skip for paging               | `$skip=100`                                 |
| `$filter`  | Filter expression                        | `$filter=startswith(JobNumber,'1001')`       |
| `$select`  | Comma-separated fields to return         | `$select=ObjectID,JobNumber,Title`          |
| `$orderby` | Sort field and direction                 | `$orderby=JobNumber asc`                    |

Parameters may be combined:

```
GET {{BaseURL}}/Job?$filter=contains(Title,'Highway')&$orderby=JobNumber asc&$top=25&$skip=0
```

---

## Endpoint Catalogue

All endpoints share the same structural patterns. Methods available for each resource are noted. A `/schema` endpoint is available for most resources.

### Utility

| Method | Endpoint              | Description                                                    |
|--------|-----------------------|----------------------------------------------------------------|
| GET    | `/Ping/{input}`       | Echo test. Returns `(hostname) input` to verify connectivity.  |
| GET    | `/Version`            | Returns the current OpsAPI version.                            |
| GET    | `/SystemInfo`         | Returns system config (e.g., `IsTIDEnabled`, `IsEMSLicensed`). |

**Ping example:**

```
GET {{BaseURL}}/Ping/hello
```

Response: `(OpsHost) hello`

---

### Authentication Endpoints

| Method | Endpoint         | Description                                         |
|--------|------------------|-----------------------------------------------------|
| GET    | `/Login`         | Authenticate with client credentials or user/pass.  |
| GET    | `/LoginWithTID`  | Authenticate using a Trimble Identity access token. |

---

### Jobs

The Job resources are the core of OpsAPI. Most sub-resources are linked to a Job via `JobID` or similar foreign key fields.

| Method | Endpoint                                | Description                                |
|--------|-----------------------------------------|--------------------------------------------|
| GET    | `/Job`                                  | List jobs (paginated, OData supported).    |
| POST   | `/Job`                                  | Create a new job.                          |
| PUT    | `/Job`                                  | Update an existing job.                    |
| DELETE | `/Job`                                  | Delete a job by `ObjectID`.                |
| GET    | `/Job/schema`                           | JSON schema for the Job model.             |
| GET    | `/JobChangeOrder`                       | List job change orders.                    |
| POST   | `/JobChangeOrder`                       | Create a job change order.                 |
| PUT    | `/JobChangeOrder`                       | Update a job change order.                 |
| DELETE | `/JobChangeOrder`                       | Delete a job change order.                 |
| GET    | `/JobCostBreakdownElement`              | List job cost breakdown elements.          |
| POST   | `/JobCostBreakdownElement`              | Create a cost breakdown element.           |
| PUT    | `/JobCostBreakdownElement`              | Update a cost breakdown element.           |
| DELETE | `/JobCostBreakdownElement`              | Delete a cost breakdown element.           |
| GET    | `/JobCostBreakdownElementMaterial`      | List materials on cost breakdown elements. |
| POST   | `/JobCostBreakdownElementMaterial`      | Create a cost breakdown element material.  |
| PUT    | `/JobCostBreakdownElementMaterial`      | Update a cost breakdown element material.  |
| DELETE | `/JobCostBreakdownElementMaterial`      | Delete a cost breakdown element material.  |
| GET    | `/JobEstimateItem`                      | List job estimate items.                   |
| POST   | `/JobEstimateItem`                      | Create a job estimate item.                |
| PUT    | `/JobEstimateItem`                      | Update a job estimate item.                |
| DELETE | `/JobEstimateItem`                      | Delete a job estimate item.                |
| GET    | `/JobFileAttachment`                    | List job file attachments.                 |
| POST   | `/JobFileAttachment`                    | Upload a job file attachment.              |
| PUT    | `/JobFileAttachment`                    | Update a job file attachment.              |
| DELETE | `/JobFileAttachment`                    | Delete a job file attachment.              |
| GET    | `/JobLaborRateClass`                    | List labor rate classes assigned to a job. |
| POST   | `/JobLaborRateClass`                    | Assign a labor rate class to a job.        |
| DELETE | `/JobLaborRateClass`                    | Remove a labor rate class from a job.      |
| GET    | `/JobMaterial`                          | List materials assigned to a job.          |
| POST   | `/JobMaterial`                          | Assign a material to a job.               |
| PUT    | `/JobMaterial`                          | Update a job material assignment.          |
| DELETE | `/JobMaterial`                          | Remove a material from a job.             |
| GET    | `/JobOrganization`                      | List organizations linked to a job.        |
| POST   | `/JobOrganization`                      | Link an organization to a job.            |
| DELETE | `/JobOrganization`                      | Remove an organization from a job.        |
| GET    | `/JobOverheadAccount`                   | List overhead accounts on a job.           |
| POST   | `/JobOverheadAccount`                   | Add an overhead account to a job.          |
| PUT    | `/JobOverheadAccount`                   | Update a job overhead account.             |
| DELETE | `/JobOverheadAccount`                   | Remove an overhead account from a job.     |
| GET    | `/JobProductionAccount`                 | List production accounts on a job.         |
| POST   | `/JobProductionAccount`                 | Add a production account to a job.         |
| PUT    | `/JobProductionAccount`                 | Update a job production account.           |
| DELETE | `/JobProductionAccount`                 | Remove a production account from a job.    |
| GET    | `/JobProductionTarget`                  | List production targets on a job.          |
| POST   | `/JobProductionTarget`                  | Create a production target on a job.       |
| PUT    | `/JobProductionTarget`                  | Update a job production target.            |
| DELETE | `/JobProductionTarget`                  | Delete a job production target.            |
| GET    | `/JobProjectManager`                    | List project managers on a job.            |
| POST   | `/JobProjectManager`                    | Assign a project manager to a job.         |
| DELETE | `/JobProjectManager`                    | Remove a project manager from a job.       |
| GET    | `/JobSite`                              | List sites linked to a job.                |
| POST   | `/JobSite`                              | Link a site to a job.                     |
| PUT    | `/JobSite`                              | Update a job site.                         |
| DELETE | `/JobSite`                              | Remove a site from a job.                 |
| GET    | `/JobSubcontractorQuote`                | List subcontractor quotes on a job.        |
| POST   | `/JobSubcontractorQuote`                | Add a subcontractor quote to a job.        |
| PUT    | `/JobSubcontractorQuote`                | Update a subcontractor quote.              |
| DELETE | `/JobSubcontractorQuote`                | Delete a subcontractor quote.              |
| GET    | `/JobTnMWorkItem`                       | List T&M work items on a job.              |
| POST   | `/JobTnMWorkItem`                       | Create a T&M work item on a job.           |
| PUT    | `/JobTnMWorkItem`                       | Update a T&M work item.                    |
| DELETE | `/JobTnMWorkItem`                       | Delete a T&M work item.                    |

**Example — List active jobs filtered by job number prefix:**

```
GET {{BaseURL}}/Job?$filter=startswith(JobNumber,'2024')&$orderby=JobNumber asc&$top=100
Headers:
  Authorization: Bearer {{Token}}
  ConnectionString: {{ConnectionString}}
```

---

### Equipment

| Method | Endpoint               | Description                          |
|--------|------------------------|--------------------------------------|
| GET    | `/Equipment`           | List equipment records.              |
| POST   | `/Equipment`           | Create an equipment record.          |
| PUT    | `/Equipment`           | Update an equipment record.          |
| DELETE | `/Equipment`           | Delete an equipment record.          |
| GET    | `/Equipment/schema`    | JSON schema for Equipment.           |
| GET    | `/EquipmentRate`       | List equipment rates.                |
| POST   | `/EquipmentRate`       | Create an equipment rate.            |
| PUT    | `/EquipmentRate`       | Update an equipment rate.            |
| DELETE | `/EquipmentRate`       | Delete an equipment rate.            |
| GET    | `/EquipmentRateClass`  | List equipment rate classes.         |
| POST   | `/EquipmentRateClass`  | Create an equipment rate class.      |
| PUT    | `/EquipmentRateClass`  | Update an equipment rate class.      |
| DELETE | `/EquipmentRateClass`  | Delete an equipment rate class.      |
| GET    | `/EquipmentType`       | List equipment types.                |
| POST   | `/EquipmentType`       | Create an equipment type.            |
| PUT    | `/EquipmentType`       | Update an equipment type.            |
| DELETE | `/EquipmentType`       | Delete an equipment type.            |

---

### Labor

| Method | Endpoint               | Description                         |
|--------|------------------------|-------------------------------------|
| GET    | `/LaborRateClass`      | List labor rate classes.            |
| POST   | `/LaborRateClass`      | Create a labor rate class.          |
| PUT    | `/LaborRateClass`      | Update a labor rate class.          |
| DELETE | `/LaborRateClass`      | Delete a labor rate class.          |
| GET    | `/LaborType`           | List labor types.                   |
| POST   | `/LaborType`           | Create a labor type.                |
| PUT    | `/LaborType`           | Update a labor type.                |
| DELETE | `/LaborType`           | Delete a labor type.                |
| GET    | `/LaborTypeRate`       | List labor type rates.              |
| POST   | `/LaborTypeRate`       | Create a labor type rate.           |
| PUT    | `/LaborTypeRate`       | Update a labor type rate.           |
| DELETE | `/LaborTypeRate`       | Delete a labor type rate.           |

---

### Materials & Parts

| Method | Endpoint            | Description                     |
|--------|---------------------|---------------------------------|
| GET    | `/Material`         | List materials.                 |
| POST   | `/Material`         | Create a material.              |
| PUT    | `/Material`         | Update a material.              |
| DELETE | `/Material`         | Delete a material.              |
| GET    | `/Miscellaneous`    | List miscellaneous items.       |
| POST   | `/Miscellaneous`    | Create a miscellaneous item.    |
| PUT    | `/Miscellaneous`    | Update a miscellaneous item.    |
| DELETE | `/Miscellaneous`    | Delete a miscellaneous item.    |
| GET    | `/Part`             | List parts.                     |
| POST   | `/Part`             | Create a part.                  |
| PUT    | `/Part`             | Update a part.                  |
| DELETE | `/Part`             | Delete a part.                  |
| GET    | `/PartInventory`    | List part inventory records.    |
| POST   | `/PartInventory`    | Create a part inventory record. |
| PUT    | `/PartInventory`    | Update a part inventory record. |
| DELETE | `/PartInventory`    | Delete a part inventory record. |

---

### Personnel

| Method | Endpoint                    | Description                              |
|--------|-----------------------------|------------------------------------------|
| GET    | `/Employee`                 | List employees.                          |
| POST   | `/Employee`                 | Create an employee.                      |
| PUT    | `/Employee`                 | Update an employee.                      |
| DELETE | `/Employee`                 | Delete an employee.                      |
| GET    | `/EmployeeCertification`    | List employee certifications.            |
| POST   | `/EmployeeCertification`    | Add a certification to an employee.      |
| PUT    | `/EmployeeCertification`    | Update an employee certification.        |
| DELETE | `/EmployeeCertification`    | Remove an employee certification.        |
| GET    | `/Contact`                  | List contacts.                           |
| POST   | `/Contact`                  | Create a contact.                        |
| PUT    | `/Contact`                  | Update a contact.                        |
| DELETE | `/Contact`                  | Delete a contact.                        |
| GET    | `/User`                     | List OPS users.                          |
| POST   | `/User`                     | Create an OPS user.                      |
| PUT    | `/User`                     | Update an OPS user.                      |
| DELETE | `/User`                     | Delete an OPS user.                      |

---

### Organization & Reference Data

| Method | Endpoint                   | Description                              |
|--------|----------------------------|------------------------------------------|
| GET    | `/BusinessUnit`            | List business units (read-only).         |
| GET    | `/BusinessUnit/schema`     | JSON schema for BusinessUnit.            |
| GET    | `/Organization`            | List organizations.                      |
| POST   | `/Organization`            | Create an organization.                  |
| PUT    | `/Organization`            | Update an organization.                  |
| DELETE | `/Organization`            | Delete an organization.                  |
| GET    | `/Category`                | List categories.                         |
| POST   | `/Category`                | Create a category.                       |
| PUT    | `/Category`                | Update a category.                       |
| DELETE | `/Category`                | Delete a category.                       |
| GET    | `/Subcategory`             | List subcategories.                      |
| POST   | `/Subcategory`             | Create a subcategory.                    |
| PUT    | `/Subcategory`             | Update a subcategory.                    |
| DELETE | `/Subcategory`             | Delete a subcategory.                    |
| GET    | `/Factor`                  | List factors.                            |
| POST   | `/Factor`                  | Create a factor.                         |
| PUT    | `/Factor`                  | Update a factor.                         |
| DELETE | `/Factor`                  | Delete a factor.                         |
| GET    | `/OverheadAccount`         | List overhead accounts.                  |
| POST   | `/OverheadAccount`         | Create an overhead account.              |
| PUT    | `/OverheadAccount`         | Update an overhead account.              |
| DELETE | `/OverheadAccount`         | Delete an overhead account.              |
| GET    | `/ProductionAccount`       | List production accounts.                |
| POST   | `/ProductionAccount`       | Create a production account.             |
| PUT    | `/ProductionAccount`       | Update a production account.             |
| DELETE | `/ProductionAccount`       | Delete a production account.             |
| GET    | `/Place`                   | List places.                             |
| POST   | `/Place`                   | Create a place.                          |
| PUT    | `/Place`                   | Update a place.                          |
| DELETE | `/Place`                   | Delete a place.                          |
| GET    | `/UnitOfMeasure`           | List units of measure.                   |
| POST   | `/UnitOfMeasure`           | Create a unit of measure.                |
| PUT    | `/UnitOfMeasure`           | Update a unit of measure.               |
| DELETE | `/UnitOfMeasure`           | Delete a unit of measure.               |
| GET    | `/ResourceEvent`           | List resource events.                    |
| POST   | `/ResourceEvent`           | Create a resource event.                 |
| PUT    | `/ResourceEvent`           | Update a resource event.                 |
| DELETE | `/ResourceEvent`           | Delete a resource event.                 |

---

### Maintenance

| Method | Endpoint                            | Description                                   |
|--------|-------------------------------------|-----------------------------------------------|
| GET    | `/MaintenanceRequest`               | List maintenance requests.                    |
| POST   | `/MaintenanceRequest`               | Create a maintenance request.                 |
| PUT    | `/MaintenanceRequest`               | Update a maintenance request.                 |
| DELETE | `/MaintenanceRequest`               | Delete a maintenance request.                 |
| GET    | `/MaintenanceRequest/enums`         | Returns valid enum values for request fields. |
| GET    | `/MaintenanceRequestAttachment`     | List attachments on maintenance requests.     |
| POST   | `/MaintenanceRequestAttachment`     | Upload an attachment.                         |
| PUT    | `/MaintenanceRequestAttachment`     | Update an attachment.                         |
| DELETE | `/MaintenanceRequestAttachment`     | Delete an attachment.                         |
| POST   | `/MaintenanceRequestAttachment/withBytes` | Upload an attachment with inline bytes.  |
| GET    | `/MaintenanceRequestComment`        | List comments on maintenance requests.        |
| POST   | `/MaintenanceRequestComment`        | Add a comment.                                |
| PUT    | `/MaintenanceRequestComment`        | Update a comment.                             |
| DELETE | `/MaintenanceRequestComment`        | Delete a comment.                             |
| GET    | `/TrackWorkOrder`                   | List track work orders.                       |
| POST   | `/TrackWorkOrder`                   | Create a track work order.                    |
| PUT    | `/TrackWorkOrder`                   | Update a track work order.                    |
| DELETE | `/TrackWorkOrder`                   | Delete a track work order.                    |

---

### Field Log

| Method | Endpoint                    | Description                              |
|--------|-----------------------------|------------------------------------------|
| GET    | `/FieldLogWorkLogStatus`    | List field log work log statuses.        |
| PUT    | `/FieldLogWorkLogStatus`    | Update a field log work log status.      |
| GET    | `/ProductionCrewTemplate`   | List production crew templates.          |
| POST   | `/ProductionCrewTemplate`   | Create a production crew template.       |
| PUT    | `/ProductionCrewTemplate`   | Update a production crew template.       |
| DELETE | `/ProductionCrewTemplate`   | Delete a production crew template.       |
| GET    | `/TransportCrewTemplate`    | List transport crew templates.           |
| POST   | `/TransportCrewTemplate`    | Create a transport crew template.        |
| PUT    | `/TransportCrewTemplate`    | Update a transport crew template.        |
| DELETE | `/TransportCrewTemplate`    | Delete a transport crew template.        |

---

### Trucking & Transport

| Method | Endpoint               | Description                        |
|--------|------------------------|------------------------------------|
| GET    | `/InternalTruck`       | List internal trucks.              |
| POST   | `/InternalTruck`       | Create an internal truck record.   |
| PUT    | `/InternalTruck`       | Update an internal truck record.   |
| DELETE | `/InternalTruck`       | Delete an internal truck record.   |
| GET    | `/SubcontractedTruck`  | List subcontracted trucks.         |
| POST   | `/SubcontractedTruck`  | Create a subcontracted truck.      |
| PUT    | `/SubcontractedTruck`  | Update a subcontracted truck.      |
| DELETE | `/SubcontractedTruck`  | Delete a subcontracted truck.      |

---

### External Integrations

| Method | Endpoint               | Description                                |
|--------|------------------------|--------------------------------------------|
| GET    | `/ExternalSystem`      | List external systems.                     |
| POST   | `/ExternalSystem`      | Register an external system.               |
| PUT    | `/ExternalSystem`      | Update an external system.                 |
| DELETE | `/ExternalSystem`      | Delete an external system.                 |
| GET    | `/ExternalUMMapping`   | List external unit-of-measure mappings.    |
| POST   | `/ExternalUMMapping`   | Create an external UM mapping.             |
| PUT    | `/ExternalUMMapping`   | Update an external UM mapping.             |
| DELETE | `/ExternalUMMapping`   | Delete an external UM mapping.             |

---

## Common Response Codes

| Code | Meaning                         | When It Occurs                                    |
|------|---------------------------------|---------------------------------------------------|
| 200  | OK                              | Successful GET or Login response.                 |
| 201  | Created                         | Successful POST; new entity created.              |
| 204  | No Content                      | Successful DELETE; entity removed.                |
| 400  | Bad Request                     | Missing or malformed request data.                |
| 401  | Unauthorized                    | Missing, expired, or invalid Bearer Token.        |
| 404  | Not Found                       | Entity or resource does not exist.                |
| 500  | Internal Server Error           | Unhandled server-side error; check server logs.   |

When a `401` is received on any data endpoint, re-authenticate using the Login endpoint and retry with the new token.

---

## CRUD Patterns

Every resource that supports full CRUD follows the same pattern.

### GET (list)

```http
GET {{BaseURL}}/Job
Authorization: Bearer {{Token}}
ConnectionString: {{ConnectionString}}
```

Optional OData query parameters may be appended as described in [OData Query Support](#odata-query-support).

### POST (create)

```http
POST {{BaseURL}}/Job
Authorization: Bearer {{Token}}
ConnectionString: {{ConnectionString}}
Content-Type: application/json

{ <job model JSON> }
```

Before posting, use the `/schema` endpoint to retrieve the required and optional fields for the model.

### PUT (update)

```http
PUT {{BaseURL}}/Job
Authorization: Bearer {{Token}}
ConnectionString: {{ConnectionString}}
Content-Type: application/json

{ <full job model JSON with modified fields> }
```

**Important:** Always GET the entity first, make targeted field changes, and then PUT the full model. Sending a partial model can overwrite existing fields with null or default values.

### DELETE

```http
DELETE {{BaseURL}}/Job
Authorization: Bearer {{Token}}
ConnectionString: {{ConnectionString}}
ObjectID: <uuid of entity to delete>
```

The `ObjectID` may also be passed as a query parameter: `?ObjectID=<uuid>`.

---

## Schema Endpoints

Every resource exposes a `GET /{Resource}/schema` endpoint that returns the JSON schema for that model, including required fields, data types, max lengths, and formats.

**Example — Get the Job schema:**

```http
GET {{BaseURL}}/Job/schema
Authorization: Bearer {{Token}}
```

Use the schema before crafting a POST or PUT body to ensure required fields are included and formats are correct.

---

## Postman Collection Usage

The repository includes a ready-to-use Postman collection with pre-request authentication scripting.

### Import

1. Open Postman.
2. Import collection: `postman/collections/B2W Ops API Integration/.resources/definition.yaml`
3. Import environment: `postman/environments/B2W Ops API.environment.yaml`

### Configure Current Values

In the **B2W Ops API** environment, fill in the **Current Value** column (not the Initial Value):

| Variable         | Value                                                                                  |
|------------------|----------------------------------------------------------------------------------------|
| `BaseURL`        | `https://b2w-eus6.b2w.trimble.com/OPSAPI_SHCreelContracting`                          |
| `ConnectionString` | `Server=b2w-eus6-PIRS,48100;Database=BUILD2WIN_SHCreelContracting;...`               |
| `ClientID`       | Your OPS client ID                                                                     |
| `ClientSecret`   | Your OPS client secret                                                                 |
| `UserName`       | Your Windows domain username (keep populated if your tenant flow expects it)           |
| `Password`       | Your Windows domain password (keep populated if your tenant flow expects it)           |
| `Token`          | Leave blank — populated automatically by collection scripts                            |

### Auto-Authentication

The collection includes a pre-request script that automatically fetches a token using `ClientID` and `ClientSecret` whenever `Token` is empty or blank. The token is stored back in the environment and reused for all requests until it expires.

### Verify Connectivity

1. Select the **B2W Ops API** environment.
2. Send `GET /Ping/{input}` — expects a `200` echo response.
3. Send `GET /Login` — confirms credentials are correct.
4. Send `GET /Job` — confirms authenticated data access.

---

## Environment Variable Reference

| `.env` Variable       | Postman Variable   | Description                                      |
|-----------------------|--------------------|--------------------------------------------------|
| `OPS_BASE_URL`        | `BaseURL`          | Tenant-specific OPS API base URL.                |
| `OPS_CLIENT_ID`       | `ClientID`         | Client credential ID for token acquisition.      |
| `OPS_CLIENT_SECRET`   | `ClientSecret`     | Client credential secret for token acquisition.  |
| `OPS_CONNECTION_STRING` | `ConnectionString` | Tenant/database header value for data endpoints. |
| `OPS_USERNAME`        | `UserName`         | Domain account name for user-based login.        |
| `OPS_PASSWORD`        | `Password`         | Account password for user-based login.           |
| *(runtime)*           | `Token`            | Bearer token; auto-populated after login.        |

See `.env.example` for the full template and `API_CREDENTIALS.md` for additional setup guidance.
