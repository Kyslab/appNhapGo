import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

const poolConfig = {
  connectionString: requireDatabaseUrl(),
  enableChannelBinding: true,
  max: Number(process.env.DB_POOL_SIZE ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

export const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});
