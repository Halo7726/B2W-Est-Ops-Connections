import { getConfig } from "@/lib/config";

type QueryOptions = {
  filter?: string;
  orderBy?: string;
  select?: string;
  top?: number;
  skip?: number;
};

let tokenCache: { value: string; expiresAt: number } | null = null;

function buildUrl(path: string, options: QueryOptions = {}): string {
  const config = getConfig();
  const url = new URL(`${config.ops.baseUrl.replace(/\/$/, "")}/${path}`);

  if (options.filter) url.searchParams.set("$filter", options.filter);
  if (options.orderBy) url.searchParams.set("$orderby", options.orderBy);
  if (options.select) url.searchParams.set("$select", options.select);
  if (typeof options.top === "number") url.searchParams.set("$top", String(options.top));
  if (typeof options.skip === "number") url.searchParams.set("$skip", String(options.skip));

  return url.toString();
}

async function fetchToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const config = getConfig();
  const loginUrl = buildUrl("Login");

  const headers: Record<string, string> = {
    userName: config.ops.username,
    password: config.ops.password,
  };

  if (config.ops.clientId) headers.ClientID = config.ops.clientId;
  if (config.ops.clientSecret) headers.ClientSecret = config.ops.clientSecret;

  const response = await fetch(loginUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OPS login failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, string>;
  const token = payload.AccessToken || payload.Token || payload.token;

  if (!token) {
    throw new Error("OPS login succeeded but no token was returned");
  }

  tokenCache = {
    value: token,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  return token;
}

export async function fetchOpsPage<T extends Record<string, unknown>>(
  entity: string,
  options: QueryOptions = {}
): Promise<T[]> {
  const config = getConfig();
  const token = await fetchToken();
  const url = buildUrl(entity, options);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ConnectionString: config.ops.connectionString,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OPS ${entity} fetch failed with status ${response.status}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data.value)) return data.value as T[];
  return [];
}

export async function fetchOpsAll<T extends Record<string, unknown>>(
  entity: string,
  options: QueryOptions = {}
): Promise<T[]> {
  const allRows: T[] = [];
  const top = options.top ?? 500;
  let skip = options.skip ?? 0;

  while (true) {
    const rows = await fetchOpsPage<T>(entity, { ...options, top, skip });
    allRows.push(...rows);

    if (rows.length < top) break;
    skip += top;

    if (skip > 100_000) {
      throw new Error("Pagination safety limit reached");
    }
  }

  return allRows;
}
