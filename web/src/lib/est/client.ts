import { getConfig } from "@/lib/config";

export type EstQueryOptions = {
  filter?: string;
  orderBy?: string;
  select?: string;
  top?: number;
  skip?: number;
};

let tokenCache: { value: string; expiresAt: number } | null = null;

function buildEstUrl(path: string, options: EstQueryOptions = {}) {
  const config = getConfig();
  const baseUrl = config.est.baseUrl.replace(/\/?$/, "");
  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);

  if (options.filter) url.searchParams.set("$filter", options.filter);
  if (options.orderBy) url.searchParams.set("$orderby", options.orderBy);
  if (options.select) url.searchParams.set("$select", options.select);
  if (typeof options.top === "number") url.searchParams.set("$top", String(options.top));
  if (typeof options.skip === "number") url.searchParams.set("$skip", String(options.skip));

  return url.toString();
}

async function fetchEstToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const config = getConfig();
  const loginUrl = buildEstUrl("Login");
  const headers: Record<string, string> = {
    userName: config.est.username,
    password: config.est.password,
  };

  if (config.est.clientId) {
    headers.ClientID = config.est.clientId;
  }

  if (config.est.clientSecret) {
    headers.ClientSecret = config.est.clientSecret;
  }

  const response = await fetch(loginUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Est login failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const token =
    typeof payload.AccessToken === "string"
      ? payload.AccessToken
      : typeof payload.Token === "string"
      ? payload.Token
      : typeof payload.token === "string"
      ? payload.token
      : undefined;

  if (!token) {
    throw new Error("Est login succeeded but no token was returned");
  }

  tokenCache = {
    value: token,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  return token;
}

function normalizeEstItems(data: unknown): unknown[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const maybeObject = data as Record<string, unknown>;
  if (Array.isArray(maybeObject.Items)) {
    return maybeObject.Items;
  }

  return [];
}

export async function fetchEstPage(entity: string, options: EstQueryOptions = {}) {
  const token = await fetchEstToken();
  const url = buildEstUrl(`Resource/${entity}`, options);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Est ${entity} fetch failed with status ${response.status}`);
  }

  const data = await response.json();
  return normalizeEstItems(data);
}

export async function fetchEstSchema(entity: string) {
  const token = await fetchEstToken();
  const url = buildEstUrl(`Resource/${entity}/schema`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Est ${entity} schema fetch failed with status ${response.status}`);
  }

  return await response.json();
}

export async function fetchEstItem(entity: string, objectId: string) {
  const items = await fetchEstPage(entity, {
    filter: `ObjectID eq '${objectId.replace(/'/g, "''")}'`,
    top: 1,
  });

  return items[0] ?? null;
}

export async function updateEstItem(entity: string, payload: unknown) {
  const token = await fetchEstToken();
  const url = buildEstUrl(`Resource/${entity}`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Est ${entity} update failed with status ${response.status}: ${body}`);
  }

  return await response.json();
}

export async function createEstItem(entity: string, payload: unknown) {
  const token = await fetchEstToken();
  const url = buildEstUrl(`Resource/${entity}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Est ${entity} create failed with status ${response.status}: ${body}`);
  }

  return await response.json();
}

export async function deleteEstItem(entity: string, objectId: string) {
  const token = await fetchEstToken();
  const url = buildEstUrl(`Resource/${entity}?objectId=${encodeURIComponent(objectId)}`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ObjectID: objectId }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Est ${entity} delete failed with status ${response.status}: ${body}`);
  }

  return await response.json();
}
