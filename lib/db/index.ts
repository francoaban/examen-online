import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definida. Copiá .env.example a .env.local y completá la cadena de conexión de Neon.",
  );
}

const isProduction = process.env.NODE_ENV === "production";

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

/**
 * En Vercel serverless cada invocación es un proceso independiente,
 * por lo que el singleton con globalThis solo tiene efecto en desarrollo
 * (evita reconexiones en cada hot-reload).
 *
 * `max: 1` en producción: con el endpoint "pooled" de Neon (PgBouncer en
 * modo transaction) cada función serverless debe usar UNA sola conexión.
 * Usar más agota el pool y genera errores "too many connections".
 *
 * `prepare: false` es obligatorio para PgBouncer/Neon pooled.
 */
function createClient() {
  return postgres(connectionString!, {
    max: isProduction ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

const client = globalForDb.__pgClient ?? createClient();

if (!isProduction) {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });