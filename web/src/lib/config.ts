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
};

export function getConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);

  if (parsed.DB_MODE === "remote" && !parsed.LIBSQL_URL) {
    throw new Error("LIBSQL_URL is required when DB_MODE=remote");
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
  };
}
