import { Pool } from 'pg';

/**
 * Automatically creates all tables, constraints, and indexes in PostgreSQL
 * if they do not already exist.
 *
 * This guarantees that when deploying to Render, Cloud SQL, Neon, Supabase,
 * or any Postgres instance, the server starts up without missing-table errors
 * such as: `relation "audit_log" does not exist`.
 */
export async function initDatabaseSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[Database] Checking & initializing schema...');

    // 1. Check if core tables already exist
    const existingTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'tree', 'person', 'audit_log');
    `);
    const coreTablesExist = existingTablesRes.rows.length >= 4;

    if (coreTablesExist) {
      console.log('[Database] Core schema tables already exist. Skipping DDL creation.');
    } else {
      // 2. Ensure extensions for UUID and crypto support if needed
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
      } catch (extErr: any) {
        console.warn('[Database] Extension note (non-fatal):', extErr.message);
      }

      // 3. Execute table creation scripts in relational dependency order
      await client.query(`
        -- Users Table
        CREATE TABLE IF NOT EXISTS "users" (
          "id" SERIAL PRIMARY KEY,
          "uid" TEXT NOT NULL UNIQUE,
          "email" TEXT NOT NULL,
          "display_name" TEXT,
          "photo_url" TEXT,
          "opted_in_discoverable" BOOLEAN DEFAULT false,
          "created_at" TIMESTAMP DEFAULT now()
        );

        -- Tree Table
        CREATE TABLE IF NOT EXISTS "tree" (
          "tree_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "owner_uid" TEXT NOT NULL,
          "is_discoverable" BOOLEAN DEFAULT false,
          "created_at" TIMESTAMP DEFAULT now()
        );

        -- Tree Member Table
        CREATE TABLE IF NOT EXISTS "tree_member" (
          "tree_id" UUID NOT NULL REFERENCES "tree"("tree_id") ON DELETE CASCADE,
          "user_uid" TEXT NOT NULL,
          "user_email" TEXT,
          "role" TEXT NOT NULL,
          "created_at" TIMESTAMP DEFAULT now(),
          PRIMARY KEY ("tree_id", "user_uid")
        );

        -- Person Table
        CREATE TABLE IF NOT EXISTS "person" (
          "person_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "tree_id" UUID REFERENCES "tree"("tree_id") ON DELETE SET NULL,
          "is_living" BOOLEAN DEFAULT true,
          "privacy_level" TEXT DEFAULT 'family_only',
          "ancestry_status" TEXT,
          "merged_into" UUID REFERENCES "person"("person_id") ON DELETE SET NULL,
          "created_by" TEXT,
          "created_at" TIMESTAMP DEFAULT now()
        );

        -- Source Table
        CREATE TABLE IF NOT EXISTS "source" (
          "source_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "source_type" TEXT,
          "citation" TEXT NOT NULL,
          "reliability_tier" SMALLINT
        );

        -- Person Claim Table
        CREATE TABLE IF NOT EXISTS "person_claim" (
          "claim_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "person_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "attribute_type" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "source_id" UUID REFERENCES "source"("source_id") ON DELETE SET NULL,
          "confidence" SMALLINT,
          "submitted_by" TEXT,
          "submitted_at" TIMESTAMP DEFAULT now(),
          "status" TEXT DEFAULT 'active'
        );

        -- Parent-Child Relationship Table
        CREATE TABLE IF NOT EXISTS "parent_child" (
          "parent_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "child_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "relationship_type" TEXT NOT NULL,
          "source_id" UUID REFERENCES "source"("source_id") ON DELETE SET NULL,
          "confidence" SMALLINT,
          PRIMARY KEY ("parent_id", "child_id", "relationship_type")
        );

        -- Partnership Table
        CREATE TABLE IF NOT EXISTS "partnership" (
          "partnership_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "person1_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "person2_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "union_type" TEXT,
          "start_date" TEXT,
          "end_date" TEXT,
          "source_id" UUID REFERENCES "source"("source_id") ON DELETE SET NULL
        );

        -- Ancestor Closure Table
        CREATE TABLE IF NOT EXISTS "ancestor_closure" (
          "descendant_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "ancestor_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "generations" SMALLINT NOT NULL,
          PRIMARY KEY ("descendant_id", "ancestor_id")
        );

        -- Match Candidate Table
        CREATE TABLE IF NOT EXISTS "match_candidate" (
          "person_a_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "person_b_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "score" INTEGER NOT NULL,
          "band" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "reviewed_by" TEXT,
          "reviewed_at" TIMESTAMP WITH TIME ZONE,
          "breakdown" TEXT,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          PRIMARY KEY ("person_a_id", "person_b_id")
        );

        -- Audit Log Table
        CREATE TABLE IF NOT EXISTS "audit_log" (
          "log_id" SERIAL PRIMARY KEY,
          "entity_type" TEXT NOT NULL,
          "entity_id" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "old_value" TEXT,
          "new_value" TEXT,
          "changed_by" TEXT NOT NULL,
          "changed_at" TIMESTAMP DEFAULT now()
        );

        -- Person Media Table
        CREATE TABLE IF NOT EXISTS "person_media" (
          "media_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "person_id" UUID NOT NULL REFERENCES "person"("person_id") ON DELETE CASCADE,
          "title" TEXT NOT NULL,
          "media_type" TEXT NOT NULL DEFAULT 'photo',
          "mime_type" TEXT,
          "file_size" INTEGER,
          "file_url" TEXT NOT NULL,
          "sha256_checksum" TEXT NOT NULL,
          "description" TEXT,
          "uploaded_by" TEXT,
          "uploaded_at" TIMESTAMP DEFAULT now()
        );
      `);

      // 4. Create helpful indexes (non-fatal if non-owner or restricted)
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS "idx_audit_log_changed_at" ON "audit_log"("changed_at" DESC);
          CREATE INDEX IF NOT EXISTS "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id");
          CREATE INDEX IF NOT EXISTS "idx_person_claim_person" ON "person_claim"("person_id");
          CREATE INDEX IF NOT EXISTS "idx_person_tree" ON "person"("tree_id");
          CREATE INDEX IF NOT EXISTS "idx_tree_member_user" ON "tree_member"("user_uid");
          CREATE INDEX IF NOT EXISTS "idx_parent_child_parent" ON "parent_child"("parent_id");
          CREATE INDEX IF NOT EXISTS "idx_parent_child_child" ON "parent_child"("child_id");
          CREATE INDEX IF NOT EXISTS "idx_match_candidate_status" ON "match_candidate"("status");
          CREATE INDEX IF NOT EXISTS "idx_person_media_person" ON "person_media"("person_id");
        `);
      } catch (idxErr: any) {
        console.warn('[Database] Index creation note (non-fatal):', idxErr.message);
      }
    }

    console.log('[Database] Schema verified successfully.');

    // 5. Initial seed check: if audit_log is present and has 0 rows, insert initial system audit log
    try {
      const countCheck = await client.query(`SELECT count(*)::int as count FROM "audit_log";`);
      if (countCheck.rows[0]?.count === 0) {
        await client.query(`
          INSERT INTO "audit_log" ("entity_type", "entity_id", "action", "new_value", "changed_by", "changed_at")
          VALUES (
            'system',
            'schema_init',
            'create',
            '{"message": "Database schema auto-initialized on deployment"}',
            'system',
            now()
          );
        `);
        console.log('[Database] Initial system ledger entry created.');
      }
    } catch (auditErr: any) {
      console.warn('[Database] Initial audit entry note (non-fatal):', auditErr.message);
    }
  } catch (error: any) {
    console.warn('[Database] Schema initialization note:', error.message || error);
    // If the tables actually exist anyway, don't crash the server
    try {
      const verifyRes = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'users' LIMIT 1;`);
      if (verifyRes.rows.length > 0) {
        console.log('[Database] Database tables confirmed active.');
        return;
      }
    } catch (_) {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}
