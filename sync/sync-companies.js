#!/usr/bin/env node
// Run locally: export $(cat .env | xargs) && node sync/sync-companies.js
// Requires Node 20+ (built-in fetch). No npm dependencies.

'use strict';

// ---------------------------------------------------------------------------
// Config & validation
// ---------------------------------------------------------------------------

const REQUIRED_VARS = [
  'EST_API_BASE_URL',
  'EST_USERNAME',
  'EST_PASSWORD',
  'EST_CLIENT_ID',
  'EST_CLIENT_SECRET',
  'EST_CONNECTION_STRING',
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
  'SP_ESTIMATING_OPERATIONS_ID',
  'SP_COMPANY_DATA_LIST_ID',
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required environment variables:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const {
  EST_API_BASE_URL,
  EST_USERNAME,
  EST_PASSWORD,
  EST_CLIENT_ID,
  EST_CLIENT_SECRET,
  EST_CONNECTION_STRING,
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  SP_ESTIMATING_OPERATIONS_ID,
  SP_COMPANY_DATA_LIST_ID,
} = process.env;

// Endpoint segment → SharePoint Company_x0020_Type display value
const ORG_TYPES = [
  { segment: 'Subcontractor',     label: 'Subcontractor' },
  { segment: 'Vendor',            label: 'Vendor' },
  { segment: 'Customer',          label: 'Customer/Owner' },
  { segment: 'Competitor',        label: 'Competitor' },
  { segment: 'EngineerArchitect', label: 'Engineer/Architect' },
];

const SP_ITEMS_URL = `https://graph.microsoft.com/v1.0/sites/${SP_ESTIMATING_OPERATIONS_ID}/lists/${SP_COMPANY_DATA_LIST_ID}/items`;

// ---------------------------------------------------------------------------
// B2W EstAPI helpers
// ---------------------------------------------------------------------------

// Login uses GET with only userName and password headers.
// ClientID/ClientSecret/ConnectionString are added to all subsequent requests only.
async function getEstToken() {
  const res = await fetch(`${EST_API_BASE_URL}/Login`, {
    method: 'GET',
    headers: {
      userName: EST_USERNAME,   // camelCase with capital N — confirmed working
      password: EST_PASSWORD,
    },
  });

  if (!res.ok) {
    throw new Error(`EstAPI /Login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.AccessToken) {
    throw new Error('EstAPI /Login response missing AccessToken');
  }
  return data.AccessToken;
}

function estHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    ClientID: EST_CLIENT_ID,
    ClientSecret: EST_CLIENT_SECRET,
    ConnectionString: EST_CONNECTION_STRING,
  };
}

// Fetches all records for one org-type endpoint in a single request.
// A 404 means no records of that type exist — treated as empty, not an error.
async function fetchOrgType(token, segment) {
  const url = `${EST_API_BASE_URL}/Resource/Organization/${segment}`;
  const res = await fetch(url, { headers: estHeaders(token) });

  if (res.status === 404) return [];

  if (!res.ok) {
    throw new Error(`EstAPI GET /Resource/Organization/${segment} failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.Items ?? [];
}

// Collects all org types and merges records sharing an ObjectID into one entry
// with a combined types array. A company listed under multiple endpoints gets
// all applicable labels so SharePoint's multi-select field is populated correctly.
async function fetchAllOrgs(token) {
  const byObjectID = new Map(); // ObjectID → { fields, types: Set }

  for (const { segment, label } of ORG_TYPES) {
    const items = await fetchOrgType(token, segment);
    console.log(`  ${segment}: ${items.length} records`);

    for (const item of items) {
      const id = item.ObjectID;
      if (!id) continue;

      if (byObjectID.has(id)) {
        byObjectID.get(id).types.add(label);
      } else {
        byObjectID.set(id, {
          ObjectID: id,
          Name: item.Name ?? '',
          Address1: item.Address1 ?? '',
          City: item.City ?? '',
          State: item.State ?? '',
          Phone: item.Phone ?? '',
          Category: item.Category ?? '',
          types: new Set([label]),
        });
      }
    }
  }

  // Convert Set → sorted Array for deterministic output
  const orgs = [];
  for (const org of byObjectID.values()) {
    orgs.push({ ...org, types: [...org.types].sort() });
  }
  return orgs;
}

// ---------------------------------------------------------------------------
// Microsoft Graph helpers
// ---------------------------------------------------------------------------

async function getGraphToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body }
  );

  if (!res.ok) {
    throw new Error(`Graph token request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Graph token response missing access_token');
  }
  return data.access_token;
}

// Fetches all existing SP list items and returns Map<B2WOrgID, spItemId>.
// Selects only the two fields needed for dedup — avoids transferring the full
// item payload for potentially large lists.
async function getExistingSpItems(graphToken) {
  const headers = {
    Authorization: `Bearer ${graphToken}`,
    Accept: 'application/json',
  };

  const map = new Map();
  let url =
    `${SP_ITEMS_URL}?$select=id,fields/Title,fields/B2WOrgID` +
    `&$expand=fields($select=Title,B2WOrgID)`;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch SP items: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    for (const item of data.value ?? []) {
      const b2wId = item.fields?.B2WOrgID;
      if (b2wId) map.set(b2wId, item.id);
    }
    url = data['@odata.nextLink'] ?? null;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

function buildPatchBody(org) {
  // On updates, Company_x0020_Type is intentionally omitted — it is managed
  // by SharePoint users and must not be overwritten by the sync.
  return {
    Title: org.Name,
    Street_x0020_Address: org.Address1,
    City: org.City,
    StateProvince: org.State,
    Company_x0020_Phone: org.Phone,
    Region: org.Category,
  };
}

function buildPostBody(org) {
  return {
    fields: {
      ...buildPatchBody(org),
      B2WOrgID: org.ObjectID,
      // Multi-select checkbox field — Graph API accepts an array of strings
      Company_x0020_Type: org.types,
    },
  };
}

async function upsertOrg(org, spMap, graphToken) {
  const headers = {
    Authorization: `Bearer ${graphToken}`,
    'Content-Type': 'application/json',
  };

  const existingId = spMap.get(org.ObjectID);

  if (existingId) {
    const res = await fetch(`${SP_ITEMS_URL}/${existingId}/fields`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(buildPatchBody(org)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PATCH ${existingId} failed: ${res.status} — ${text}`);
    }
    return 'updated';
  } else {
    const res = await fetch(SP_ITEMS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildPostBody(org)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST failed: ${res.status} — ${text}`);
    }
    return 'created';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let created = 0;
  let updated = 0;
  let errors = 0;

  console.log('--- Fetching B2W EstAPI token ---');
  const estToken = await getEstToken();

  console.log('--- Fetching org records from EstAPI ---');
  const orgs = await fetchAllOrgs(estToken);
  console.log(`Total unique organizations: ${orgs.length}`);

  console.log('--- Fetching Microsoft Graph token ---');
  const graphToken = await getGraphToken();

  console.log('--- Fetching existing SharePoint list items ---');
  const spMap = await getExistingSpItems(graphToken);
  console.log(`Existing SP items with B2WOrgID: ${spMap.size}`);

  console.log('--- Upserting organizations ---');
  for (const org of orgs) {
    try {
      const result = await upsertOrg(org, spMap, graphToken);
      if (result === 'created') created++;
      else updated++;
    } catch (err) {
      errors++;
      console.error(`  ERROR [${org.Name || org.ObjectID}]: ${err.message}`);
    }
  }

  console.log(`\nSync complete. Created: ${created} | Updated: ${updated} | Errors: ${errors}`);

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
