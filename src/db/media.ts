import { db } from './index.ts';
import { personMedia, person } from './schema.ts';
import { desc, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { PersonMediaRecord, MediaType } from '../types.ts';
import { recordAuditEntry } from './audit.ts';

export interface CreateMediaInput {
  personId: string;
  title: string;
  mediaType: MediaType | string;
  mimeType?: string;
  fileSize?: number;
  fileUrl: string; // Base64 data URI or hosted link
  description?: string;
  uploadedBy?: string;
  sha256Checksum?: string; // Optional client-computed hash or server will compute from fileUrl/content
}

/**
 * Computes a SHA-256 hex checksum for a given string or base64 buffer
 */
export function computeSha256(content: string | Buffer): string {
  const hash = crypto.createHash('sha256');
  if (typeof content === 'string' && content.startsWith('data:')) {
    // Extract raw base64 part
    const base64Data = content.split(',')[1] || content;
    const buf = Buffer.from(base64Data, 'base64');
    hash.update(buf);
  } else {
    hash.update(content);
  }
  return hash.digest('hex');
}

/**
 * Add a media attachment to a person record, calculating SHA-256 checksum and recording audit log
 */
export async function addPersonMedia(input: CreateMediaInput): Promise<PersonMediaRecord> {
  try {
    const computedChecksum = input.sha256Checksum || computeSha256(input.fileUrl);

    const inserted = await db
      .insert(personMedia)
      .values({
        personId: input.personId,
        title: input.title.trim(),
        mediaType: input.mediaType || 'photo',
        mimeType: input.mimeType || null,
        fileSize: input.fileSize || null,
        fileUrl: input.fileUrl,
        sha256Checksum: computedChecksum,
        description: input.description?.trim() || null,
        uploadedBy: input.uploadedBy || 'user',
      })
      .returning();

    const row = inserted[0];

    const mediaRecord: PersonMediaRecord = {
      mediaId: row.mediaId,
      personId: row.personId,
      title: row.title,
      mediaType: row.mediaType,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      fileUrl: row.fileUrl,
      sha256Checksum: row.sha256Checksum,
      description: row.description,
      uploadedBy: row.uploadedBy,
      uploadedAt: row.uploadedAt ? row.uploadedAt.toISOString() : new Date().toISOString(),
    };

    // Record audit log entry
    await recordAuditEntry({
      entityType: 'person_media',
      entityId: mediaRecord.mediaId,
      action: 'insert',
      oldValue: null,
      newValue: {
        personId: mediaRecord.personId,
        title: mediaRecord.title,
        mediaType: mediaRecord.mediaType,
        sha256Checksum: mediaRecord.sha256Checksum,
        fileSize: mediaRecord.fileSize,
      },
      changedBy: input.uploadedBy || 'user',
    });

    return mediaRecord;
  } catch (error) {
    console.error('Failed to add person media in PostgreSQL:', error);
    throw new Error('Database query failed. Could not save media attachment.', { cause: error });
  }
}

/**
 * Fetch all media attached to a person
 */
export async function getMediaForPerson(personId: string): Promise<PersonMediaRecord[]> {
  try {
    const rows = await db
      .select()
      .from(personMedia)
      .where(eq(personMedia.personId, personId))
      .orderBy(desc(personMedia.uploadedAt));

    return rows.map((r) => ({
      mediaId: r.mediaId,
      personId: r.personId,
      title: r.title,
      mediaType: r.mediaType,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      fileUrl: r.fileUrl,
      sha256Checksum: r.sha256Checksum,
      description: r.description,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt ? r.uploadedAt.toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to get media for person:', error);
    throw new Error('Database query failed. Could not fetch media.', { cause: error });
  }
}

/**
 * Delete a media item by mediaId
 */
export async function deletePersonMedia(mediaId: string, userUid: string): Promise<boolean> {
  try {
    const existing = await db
      .select()
      .from(personMedia)
      .where(eq(personMedia.mediaId, mediaId));

    if (!existing || existing.length === 0) {
      return false;
    }

    const row = existing[0];

    await db.delete(personMedia).where(eq(personMedia.mediaId, mediaId));

    // Audit log
    await recordAuditEntry({
      entityType: 'person_media',
      entityId: mediaId,
      action: 'delete',
      oldValue: {
        personId: row.personId,
        title: row.title,
        mediaType: row.mediaType,
        sha256Checksum: row.sha256Checksum,
      },
      newValue: null,
      changedBy: userUid,
    });

    return true;
  } catch (error) {
    console.error('Failed to delete person media:', error);
    throw new Error('Database query failed. Could not delete media.', { cause: error });
  }
}
