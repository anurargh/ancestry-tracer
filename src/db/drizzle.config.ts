import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

const isLocal =
  databaseUrl?.includes('localhost') ||
  databaseUrl?.includes('127.0.0.1') ||
  sqlHost?.includes('localhost') ||
  sqlHost === '127.0.0.1';

const dbCredentials = databaseUrl
  ? {
      url: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    }
  : {
      host: sqlHost || 'localhost',
      user: user || 'postgres',
      password: password || '',
      database: sqlDbName || 'postgres',
      ssl: false,
    };

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: dbCredentials as any,
  verbose: true,
});

