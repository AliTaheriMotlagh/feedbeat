import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// postgres.js connects lazily, so a missing URL only fails when a query runs
// (keeps `next build` working without a database).
// `prepare: false` keeps us compatible with transaction-mode poolers (Neon, Supabase, PgBouncer).
const client = (globalForDb.pg ??= postgres(env.DATABASE_URL ?? "postgres://missing-database-url@127.0.0.1:1/none", {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
}));

export const db = drizzle({ client, schema });

export type Db = typeof db;
export { schema };
