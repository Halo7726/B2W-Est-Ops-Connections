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

// Pass --discover to dump raw API fields for one company and exit (no SP writes)
const DISCOVER_MODE = process.argv.includes('--discover');

const requiredForSync = REQUIRED_VARS;
const requiredForDiscover = REQUIRED_VARS.slice(0, 6); // only EST_ vars needed
const missing = (DISCOVER_MODE ? requiredForDiscover : requiredForSync).filter((v) => !process.env[v]);
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
    ConnectionString: EST_CONNECTION_STRING,
    ClientID: EST_CLIENT_ID,
    ClientSecret: EST_CLIENT_SECRET,
    'Cache-Control': 'no-cache',
  };
}

// Fetches all records for one org-type endpoint in a single request.
// A 404 means no records of that type exist — treated as empty, not an error.
// 5xx responses are retried up to MAX_RETRIES times (transient DB/SSL timeouts on B2W side).
// If all retries fail, logs a warning and returns [] so the rest of the sync continues.
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5000; // 5s, 15s, 45s

async function fetchOrgType(token, segment) {
  const url = `${EST_API_BASE_URL}/Resource/Organization/${segment}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: estHeaders(token) });

    if (res.status === 404) return [];

    if (res.ok) {
      const data = await res.json();
      return data.Items ?? [];
    }

    const body = await res.text();
    const isRetryable = res.status >= 500;

    if (!isRetryable || attempt === MAX_RETRIES) {
      throw new Error(
        `EstAPI GET /Resource/Organization/${segment} failed: ${res.status} ${res.statusText}\n${body}`
      );
    }

    const delay = RETRY_BASE_MS * attempt;
    console.warn(
      `  [${segment}] attempt ${attempt}/${MAX_RETRIES} got ${res.status} — retrying in ${delay / 1000}s...`
    );
    await new Promise((r) => setTimeout(r, delay));
  }
}

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

// Collects all org types and produces one record per unique company name.
//
// Why multiple rows per company: B2W's EstAPI returns one row per
// company-estimate link (the relationship/junction table). The same company
// appears once per estimate it has been invited to bid, each with its own
// ObjectID. The row where EstimateREF === ZERO_GUID is the base company record
// not tied to any estimate — we prefer that row as the canonical source of
// truth. Its ObjectID becomes the stable B2WOrgID written to SharePoint so
// that future syncs can match and update the same item.
//
// If a company has no zero-EstimateREF row (added only via estimates, never
// as a standalone entry) we fall back to the first row seen.
async function fetchAllOrgs(token) {
  const byName = new Map(); // lowercased Name → { org fields, types: Set, hasBase: bool }

  for (const { segment, label } of ORG_TYPES) {
    let items;
    try {
      items = await fetchOrgType(token, segment);
    } catch (err) {
      console.error(`  [${segment}] all retries failed — skipping segment: ${err.message}`);
      items = [];
      skippedSegments++;
    }
    console.log(`  ${segment}: ${items.length} records`);

    for (const item of items) {
      const name = (item.Name ?? '').trim();
      if (!name || !item.ObjectID) continue;

      const key = name.toLowerCase();
      const isBase = item.EstimateREF === ZERO_GUID;

      if (byName.has(key)) {
        const existing = byName.get(key);
        existing.types.add(label);
        // Upgrade to base record if we haven't seen one yet
        if (isBase && !existing.hasBase) {
          existing.hasBase = true;
          existing.ObjectID = item.ObjectID;
          existing.Address1 = item.Address1 ?? '';
          existing.City = item.City ?? '';
          existing.State = item.State ?? '';
          existing.Zip = item.Zip ?? '';
          existing.Phone = item.Phone ?? '';
          existing.WebAddress = item.WebAddress ?? '';
          existing.Category = item.Category ?? '';
          existing.Notes = item.Notes ?? '';
        }
      } else {
        byName.set(key, {
          hasBase: isBase,
          ObjectID: item.ObjectID,
          Name: name,
          Address1: item.Address1 ?? '',
          City: item.City ?? '',
          State: item.State ?? '',
          Zip: item.Zip ?? '',
          Phone: item.Phone ?? '',
          WebAddress: item.WebAddress ?? '',
          Category: item.Category ?? '',
          Notes: item.Notes ?? '',
          types: new Set([label]),
        });
      }
    }
  }

  const orgs = [];
  for (const { hasBase: _, ...org } of byName.values()) {
    orgs.push({ ...org, types: [...org.types].sort() });
  }
  return orgs;
}

// ---------------------------------------------------------------------------
// Contact fetching
// ---------------------------------------------------------------------------

// Fetches all contacts for one org-type segment and returns a Map keyed by
// OrganizationREF (the org's ObjectID) → [contact, ...] sorted default-first.
// The endpoint pattern is the same as orgs with /Contact appended.
async function fetchContactsForSegment(token, segment) {
  const url = `${EST_API_BASE_URL}/Resource/Organization/${segment}/Contact`;
  const res = await fetch(url, { headers: estHeaders(token) });

  if (res.status === 404) return new Map();
  if (!res.ok) {
    const body = await res.text();
    console.warn(`  [${segment}/Contact] ${res.status} — skipping contacts for this type\n  ${body}`);
    return new Map();
  }

  const data = await res.json();
  const items = data.Items ?? [];

  const byOrgRef = new Map();
  for (const c of items) {
    if (!c.OrganizationREF) continue;
    const list = byOrgRef.get(c.OrganizationREF) ?? [];
    list.push(c);
    byOrgRef.set(c.OrganizationREF, list);
  }

  // Sort so IsDefaultContact comes first
  for (const list of byOrgRef.values()) {
    list.sort((a, b) => (b.IsDefaultContact ? 1 : 0) - (a.IsDefaultContact ? 1 : 0));
  }

  return byOrgRef;
}

// Fetches contacts across all org-type segments and merges into one Map
// keyed by OrganizationREF. A contact seen via multiple segments is deduplicated
// by ObjectID so it isn't listed twice on the same company row.
async function fetchAllContacts(token) {
  const merged = new Map(); // OrganizationREF → Map<contactObjectID, contact>

  for (const { segment } of ORG_TYPES) {
    const segmentMap = await fetchContactsForSegment(token, segment);
    for (const [orgRef, contacts] of segmentMap) {
      if (!merged.has(orgRef)) merged.set(orgRef, new Map());
      const seen = merged.get(orgRef);
      for (const c of contacts) {
        if (!seen.has(c.ObjectID)) seen.set(c.ObjectID, c);
      }
    }
  }

  // Flatten inner Map → sorted array (default contact first, max 2)
  const result = new Map();
  for (const [orgRef, contactMap] of merged) {
    const sorted = [...contactMap.values()].sort(
      (a, b) => (b.IsDefaultContact ? 1 : 0) - (a.IsDefaultContact ? 1 : 0)
    );
    result.set(orgRef, sorted.slice(0, 2));
  }
  return result;
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
    const body = await res.text();
    throw new Error(`Graph token request failed: ${res.status} ${res.statusText}\n${body}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Graph token response missing access_token');
  }
  return data.access_token;
}

// Fetches all existing SP list items keyed by lowercased Title (company name).
// Title has enforceUniqueValues=true in this list so it is a safe match key.
async function getExistingSpItems(graphToken) {
  const headers = {
    Authorization: `Bearer ${graphToken}`,
    Accept: 'application/json',
  };

  const map = new Map(); // lowercased Title → SP item id
  let url = `${SP_ITEMS_URL}?$select=id&$expand=fields($select=Title)`;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch SP items: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    for (const item of data.value ?? []) {
      const title = item.fields?.Title;
      if (title) map.set(title.toLowerCase(), item.id);
    }
    url = data['@odata.nextLink'] ?? null;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

// Builds the fields payload using the exact SP internal column names from the
// Company Data list. Columns managed by SharePoint users (Approved, Certifications,
// Prequalified, Typical Scope, Work Type, Work Subtype, W-9, COI, Subcontract
// Agreement) are intentionally omitted so the sync never overwrites them.
function buildFields(org) {
  return {
    Title:                              org.Name,
    Street_x0020_Address:               org.Address1,
    City:                               org.City,
    State:                              org.State,
    Zip_x0020_Code:                     org.Zip,
    Region:                             org.Category,
    Company_x0020_Phone:                org.Phone,
    Web_x0020_Address:                  org.WebAddress,
    Notes:                              org.Notes,
    // Contact 1 (IsDefaultContact = true, or first contact found)
    Contact_x0020_Name_x0020_1:         org.contact1?.Name ?? '',
    Contact_x0020_Title:                org.contact1?.Title ?? '',
    Extension_x002f_Direct_x0020_Lin:   org.contact1?.Extension ?? '',
    Mobile_x0020_Number_x0020_1:        org.contact1?.MobileNumber ?? '',
    Email_x0020_1:                      org.contact1?.Email ?? '',
    // Contact 2
    Contact_x0020_Name_x0020_2:         org.contact2?.Name ?? '',
    Contact_x0020_Title_x0020_2:        org.contact2?.Title ?? '',
    Extension_x002f_Direct_x0020_Lin0:  org.contact2?.Extension ?? '',
    Mobile_x0020_Phone_x0020_2:         org.contact2?.MobileNumber ?? '',
    Email_x0020_2:                      org.contact2?.Email ?? '',
  };
}

function buildPostBody(org) {
  return {
    fields: {
      ...buildFields(org),
      // Set on creation only — managed by SP users after that
      Company_x0020_Type: org.types,
    },
  };
}

async function upsertOrg(org, spMap, graphToken) {
  const headers = {
    Authorization: `Bearer ${graphToken}`,
    'Content-Type': 'application/json',
  };

  const existingId = spMap.get(org.Name.toLowerCase());

  if (existingId) {
    // PATCH: omit Company_x0020_Type — managed by SP users
    const res = await fetch(`${SP_ITEMS_URL}/${existingId}/fields`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(buildFields(org)),
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
  let skippedSegments = 0;

  console.log('--- Fetching B2W EstAPI token ---');
  const estToken = await getEstToken();

  console.log('--- Fetching org records from EstAPI ---');
  const orgs = await fetchAllOrgs(estToken);

  console.log('--- Fetching contacts from EstAPI ---');
  const contactsByOrgRef = await fetchAllContacts(estToken);
  console.log(`Organizations with contacts: ${contactsByOrgRef.size}`);

  // Attach up to 2 contacts to each org (default contact = contact1)
  for (const org of orgs) {
    const contacts = contactsByOrgRef.get(org.ObjectID) ?? [];
    org.contact1 = contacts[0] ?? null;
    org.contact2 = contacts[1] ?? null;
  }
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

  console.log(
    `\nSync complete. Created: ${created} | Updated: ${updated} | Errors: ${errors}` +
    (skippedSegments > 0 ? ` | Skipped segments: ${skippedSegments}` : '')
  );

  if (errors > 0 || skippedSegments > 0) process.exit(1);
}

async function discover() {
  console.log('--- DISCOVER MODE: showing raw API fields (no SharePoint writes) ---\n');
  const token = await getEstToken();

  for (const { segment } of ORG_TYPES) {
    const url = `${EST_API_BASE_URL}/Resource/Organization/${segment}`;
    const res = await fetch(url, { headers: estHeaders(token) });
    if (res.status === 404) { console.log(`${segment}: (no records)`); continue; }
    if (!res.ok) { console.log(`${segment}: ERROR ${res.status}`); continue; }

    const data = await res.json();
    const items = data.Items ?? [];
    console.log(`=== ${segment} — ${items.length} rows total ===`);

    if (items.length === 0) continue;

    // Show all field keys available
    const allKeys = [...new Set(items.flatMap(Object.keys))];
    console.log('Fields available:', allKeys);

    // Group rows by Name to show how many rows per company
    const byName = new Map();
    for (const item of items) {
      const n = item.Name ?? '(no name)';
      byName.set(n, (byName.get(n) ?? 0) + 1);
    }
    const dupes = [...byName.entries()].filter(([, count]) => count > 1);
    console.log(`Unique companies: ${byName.size} | Companies with multiple rows: ${dupes.length}`);
    if (dupes.length > 0) {
      console.log('  Dupe examples:', dupes.slice(0, 5).map(([n, c]) => `"${n}" x${c}`).join(', '));
    }

    // Dump first 2 raw records so we can see all fields
    console.log('\nFirst 2 raw records:');
    console.log(JSON.stringify(items.slice(0, 2), null, 2));

    // Try the contacts sub-endpoint
    const contactUrl = `${EST_API_BASE_URL}/Resource/Organization/${segment}/Contact`;
    const cr = await fetch(contactUrl, { headers: estHeaders(token) });
    if (cr.ok) {
      const cd = await cr.json();
      const contacts = cd.Items ?? [];
      console.log(`\n${segment}/Contact — ${contacts.length} total contacts`);
      if (contacts.length > 0) {
        console.log('Contact fields:', [...new Set(contacts.flatMap(Object.keys))]);
        console.log('First 2 contacts:', JSON.stringify(contacts.slice(0, 2), null, 2));
      }
    } else {
      console.log(`\n${segment}/Contact — ${cr.status} (endpoint may not exist or be named differently)`);
    }
    console.log();
  }
}

if (DISCOVER_MODE) {
  discover().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
} else {
  main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}
