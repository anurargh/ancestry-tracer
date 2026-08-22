import { db } from './index.ts';
import { auditLog } from './schema.ts';
import { desc, eq, and, sql, ilike, or } from 'drizzle-orm';
import { AuditLogRecord } from '../types.ts';

export interface AuditEntryInput {
  entityType: 'person_claim' | 'parent_child' | 'partnership' | 'match_candidate' | 'person' | 'person_media' | string;
  entityId: string;
  action: 'insert' | 'update' | 'supersede' | 'delete' | 'merge' | 'create' | string;
  oldValue?: any;
  newValue?: any;
  changedBy: string;
}

/**
 * Record an audit log entry for any insert, update, superseding, relationship link, or merge.
 */
export async function recordAuditEntry(entry: AuditEntryInput): Promise<AuditLogRecord | null> {
  try {
    const stringifiedOld = entry.oldValue !== undefined && entry.oldValue !== null
      ? (typeof entry.oldValue === 'string' ? entry.oldValue : JSON.stringify(entry.oldValue))
      : null;

    const stringifiedNew = entry.newValue !== undefined && entry.newValue !== null
      ? (typeof entry.newValue === 'string' ? entry.newValue : JSON.stringify(entry.newValue))
      : null;

    const inserted = await db
      .insert(auditLog)
      .values({
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        oldValue: stringifiedOld,
        newValue: stringifiedNew,
        changedBy: entry.changedBy || 'system',
      })
      .returning();

    const row = inserted[0];
    return {
      logId: row.logId,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      oldValue: row.oldValue ? parseJsonSafely(row.oldValue) : null,
      newValue: row.newValue ? parseJsonSafely(row.newValue) : null,
      changedBy: row.changedBy,
      changedAt: row.changedAt ? row.changedAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to record audit log entry:', error);
    // Non-blocking for core transaction if audit logging fails
    return null;
  }
}

function parseJsonSafely(val: string) {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export interface GetAuditLogsFilter {
  entityType?: string;
  action?: string;
  entityId?: string;
  changedBy?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query audit logs with rich filtering, search, and pagination
 */
export async function getAuditLogs(filter: GetAuditLogsFilter = {}) {
  try {
    const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
    const offset = Math.max(filter.offset || 0, 0);

    const conditions: any[] = [];

    if (filter.entityType && filter.entityType !== 'all') {
      conditions.push(eq(auditLog.entityType, filter.entityType));
    }

    if (filter.action && filter.action !== 'all') {
      conditions.push(eq(auditLog.action, filter.action));
    }

    if (filter.entityId) {
      conditions.push(eq(auditLog.entityId, filter.entityId));
    }

    if (filter.changedBy) {
      conditions.push(ilike(auditLog.changedBy, `%${filter.changedBy}%`));
    }

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(auditLog.entityId, q),
          ilike(auditLog.changedBy, q),
          ilike(auditLog.oldValue, q),
          ilike(auditLog.newValue, q),
          ilike(auditLog.entityType, q),
          ilike(auditLog.action, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Fetch total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // 2. Fetch rows
    const rows = await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.changedAt), desc(auditLog.logId))
      .limit(limit)
      .offset(offset);

    // 3. Fetch summary stats
    const statsResult = await db
      .select({
        entityType: auditLog.entityType,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLog)
      .groupBy(auditLog.entityType);

    const stats: Record<string, number> = {};
    for (const s of statsResult) {
      stats[s.entityType] = s.count;
    }

    const logs: AuditLogRecord[] = rows.map((r) => ({
      logId: r.logId,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      oldValue: r.oldValue ? parseJsonSafely(r.oldValue) : null,
      newValue: r.newValue ? parseJsonSafely(r.newValue) : null,
      changedBy: r.changedBy,
      changedAt: r.changedAt ? r.changedAt.toISOString() : new Date().toISOString(),
    }));

    return {
      logs,
      total,
      limit,
      offset,
      stats,
    };
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw new Error('Failed to query audit logs from database', { cause: error });
  }
}
