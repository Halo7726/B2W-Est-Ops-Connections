import { z } from "zod";

const envSchema = z.object({
  DB_MODE: z.enum(["local", "remote"]).default("local"),
  LOCAL_SQLITE_PATH: z.string().default("./data/local.db"),
  LIBSQL_URL: z.string().optional(),
  LIBSQL_AUTH_TOKEN: z.string().optional(),
  OPS_BASE_URL: z.string().min(1, "OPS_BASE_URL is required"),
  OPS_CONNECTION_STRING: z.string().min(1, "OPS_CONNECTION_STRING is required"),
  OPS_USERNAME: z.string().min(1, "OPS_USERNAME is required"),
  OPS_PASSWORD: z.string().min(1, "OPS_PASSWORD is required"),
  OPS_CLIENT_ID: z.string().optional(),
  OPS_CLIENT_SECRET: z.string().optional(),
  EST_BASE_URL: z.string().min(1, "EST_BASE_URL is required"),
  EST_USERNAME: z.string().min(1, "EST_USERNAME is required"),
  EST_PASSWORD: z.string().min(1, "EST_PASSWORD is required"),
  EST_CLIENT_ID: z.string().optional(),
  EST_CLIENT_SECRET: z.string().optional(),
});

export type AppConfig = {
  db: {
    mode: "local" | "remote";
    localPath: string;
    libsqlUrl?: string;
    libsqlAuthToken?: string;
  };
  ops: {
    baseUrl: string;
    connectionString: string;
    username: string;
    password: string;
    clientId?: string;
    clientSecret?: string;
  };
  est: {
    baseUrl: string;
    username: string;
    password: string;
    clientId?: string;
    clientSecret?: string;
  };
};

export function getConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);

  if (parsed.DB_MODE === "remote" && !parsed.LIBSQL_URL) {
    throw new Error("LIBSQL_URL is required when DB_MODE=remote");
  }

  let opsUrl: URL;
  try {
    opsUrl = new URL(parsed.OPS_BASE_URL);
  } catch {
    throw new Error("OPS_BASE_URL must be a valid URL");
  }

  if (!opsUrl.pathname.toLowerCase().includes("opsapi")) {
    throw new Error("OPS_BASE_URL must point to an OPSAPI endpoint path");
  }

  return {
    db: {
      mode: parsed.DB_MODE,
      localPath: parsed.LOCAL_SQLITE_PATH,
      libsqlUrl: parsed.LIBSQL_URL,
      libsqlAuthToken: parsed.LIBSQL_AUTH_TOKEN,
    },
    ops: {
      baseUrl: parsed.OPS_BASE_URL,
      connectionString: parsed.OPS_CONNECTION_STRING,
      username: parsed.OPS_USERNAME,
      password: parsed.OPS_PASSWORD,
      clientId: parsed.OPS_CLIENT_ID,
      clientSecret: parsed.OPS_CLIENT_SECRET,
    },
    est: {
      baseUrl: parsed.EST_BASE_URL,
      username: parsed.EST_USERNAME,
      password: parsed.EST_PASSWORD,
      clientId: parsed.EST_CLIENT_ID,
      clientSecret: parsed.EST_CLIENT_SECRET,
    },
  };
}
