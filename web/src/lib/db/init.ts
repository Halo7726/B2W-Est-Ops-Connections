import { getDb } from "@/lib/db/client";

async function main() {
  await getDb();
  console.log("Database initialized");
}

main().catch((error) => {
  console.error("Database initialization failed", error);
  process.exit(1);
});
