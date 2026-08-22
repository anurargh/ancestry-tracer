import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// Users table for Firebase Auth accounts & session management
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  optedInDiscoverable: boolean('opted_in_discoverable').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tree Table for per-tree management and access control
export const tree = pgTable('tree', {
  treeId: uuid('tree_id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerUid: text('owner_uid').notNull(),
  isDiscoverable: boolean('is_discoverable').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tree Member Table for RBAC roles (owner, editor, viewer)
export const treeMember = pgTable(
  'tree_member',
  {
    treeId: uuid('tree_id')
      .references(() => tree.treeId, { onDelete: 'cascade' })
      .notNull(),
    userUid: text('user_uid').notNull(),
    userEmail: text('user_email'),
    role: text('role').notNull(), // 'owner' | 'editor' | 'viewer'
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.treeId, t.userUid] }),
  })
);

// 1. Person Table
// Core entity node: does NOT contain name, birth date, or birth place directly.
// Those attributes are modeled as claims in person_claim to support conflicting/sourced assertions.
export const person = pgTable('person', {
  personId: uuid('person_id').defaultRandom().primaryKey(),
  treeId: uuid('tree_id').references((): AnyPgColumn => tree.treeId, {
    onDelete: 'set null',
  }),
  isLiving: boolean('is_living').default(true),
  privacyLevel: text('privacy_level').default('family_only'), // living defaults to family_only
  ancestryStatus: text('ancestry_status'),
  mergedInto: uuid('merged_into').references((): AnyPgColumn => person.personId, {
    onDelete: 'set null',
  }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Source Table
// Citations, documents, archives, census records, and reliability rankings.
export const source = pgTable('source', {
  sourceId: uuid('source_id').defaultRandom().primaryKey(),
  sourceType: text('source_type'),
  citation: text('citation').notNull(),
  reliabilityTier: smallint('reliability_tier'),
});

// 3. Person Claim Table
// Sourced attribute assertions (e.g. name, date_of_birth, birthplace, etc.)
// Allows multiple conflicting values per person with distinct source references and confidence scores.
export const personClaim = pgTable('person_claim', {
  claimId: uuid('claim_id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .references(() => person.personId, { onDelete: 'cascade' })
    .notNull(),
  attributeType: text('attribute_type').notNull(),
  value: text('value').notNull(),
  sourceId: uuid('source_id').references(() => source.sourceId, {
    onDelete: 'set null',
  }),
  confidence: smallint('confidence'),
  submittedBy: text('submitted_by'),
  submittedAt: timestamp('submitted_at').defaultNow(),
  status: text('status').default('active'),
});

// 4. Parent-Child Relationship Table
// Composite PK on parent_id + child_id + relationship_type
export const parentChild = pgTable(
  'parent_child',
  {
    parentId: uuid('parent_id')
      .references(() => person.personId, { onDelete: 'cascade' })
      .notNull(),
    childId: uuid('child_id')
      .references(() => person.personId, { onDelete: 'cascade' })
      .notNull(),
    relationshipType: text('relationship_type').notNull(),
    sourceId: uuid('source_id').references(() => source.sourceId, {
      onDelete: 'set null',
    }),
    confidence: smallint('confidence'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.parentId, t.childId, t.relationshipType] }),
  })
);

// 5. Partnership Table
// Marriages, domestic partnerships, and unions between individuals
export const partnership = pgTable('partnership', {
  partnershipId: uuid('partnership_id').defaultRandom().primaryKey(),
  person1Id: uuid('person1_id')
    .references(() => person.personId, { onDelete: 'cascade' })
    .notNull(),
  person2Id: uuid('person2_id')
    .references(() => person.personId, { onDelete: 'cascade' })
    .notNull(),
  unionType: text('union_type'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  sourceId: uuid('source_id').references(() => source.sourceId, {
    onDelete: 'set null',
  }),
});

// 6. Ancestor Closure Table
// Stores, for every person, every ancestor reachable through parent_child edges
// up to 10 generations, with the minimum number of generations between them
// (e.g. keeping the smaller count when reachable through multiple paths / cousin marriages).
// Composite Primary Key on (descendant_id, ancestor_id)
export const ancestorClosure = pgTable(
  'ancestor_closure',
  {
    descendantId: uuid('descendant_id')
      .references(() => person.personId, { onDelete: 'cascade' })
      .notNull(),
    ancestorId: uuid('ancestor_id')
      .references(() => person.personId, { onDelete: 'cascade' })
      .notNull(),
    generations: smallint('generations').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.descendantId, t.ancestorId] }),
  })
);

// 7. Duplicate Match Candidate Table
// Stores candidate duplicate pairs between two people, evaluated by blocking on Soundex(surname) + birth decade
// and scored using fuzzy name similarity, birth date proximity, birthplace match, and linked family resolution.
export const matchCandidate = pgTable(
  'match_candidate',
  {
    personAId: uuid('person_a_id')
      .references(() => person.personId, { onDelete: 'cascade' })
      .notNull(),
    personBId: uuid('person_b_id')
      .references(() => person.personId, { onDelete: 'cascade' })
      .notNull(),
    score: integer('score').notNull(),
    band: text('band').notNull(), // 'strong' | 'possible' | 'unlikely'
    status: text('status').default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    breakdown: text('breakdown'), // JSON formatted explanation of scoring components
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.personAId, t.personBId] }),
  })
);

// 8. Audit Log Table
// Records every insert, update, superseding, relationship link, and merge with full before/after snapshots and authorship.
export const auditLog = pgTable('audit_log', {
  logId: serial('log_id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'person_claim' | 'parent_child' | 'partnership' | 'match_candidate' | 'person'
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'insert' | 'update' | 'supersede' | 'delete' | 'merge' | 'create'
  oldValue: text('old_value'), // JSON snapshot of previous state
  newValue: text('new_value'), // JSON snapshot of new state
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at').defaultNow(),
});

// 9. Person Media Table
// Attached primary source photos, census records, certificates, and archival documents with SHA-256 integrity checksums.
export const personMedia = pgTable('person_media', {
  mediaId: uuid('media_id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .references(() => person.personId, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  mediaType: text('media_type').default('photo').notNull(), // 'photo' | 'document' | 'certificate' | 'census_record' | 'other'
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  fileUrl: text('file_url').notNull(),
  sha256Checksum: text('sha256_checksum').notNull(),
  description: text('description'),
  uploadedBy: text('uploaded_by'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// Relations
export const treeRelations = relations(tree, ({ many }) => ({
  members: many(treeMember),
  people: many(person),
}));

export const treeMemberRelations = relations(treeMember, ({ one }) => ({
  tree: one(tree, {
    fields: [treeMember.treeId],
    references: [tree.treeId],
  }),
}));

export const personRelations = relations(person, ({ many, one }) => ({
  tree: one(tree, {
    fields: [person.treeId],
    references: [tree.treeId],
  }),
  claims: many(personClaim),
  parentRelationships: many(parentChild, { relationName: 'asParent' }),
  childRelationships: many(parentChild, { relationName: 'asChild' }),
  partnershipsAsPerson1: many(partnership, { relationName: 'asPerson1' }),
  partnershipsAsPerson2: many(partnership, { relationName: 'asPerson2' }),
  ancestors: many(ancestorClosure, { relationName: 'asClosureDescendant' }),
  descendants: many(ancestorClosure, { relationName: 'asClosureAncestor' }),
  matchCandidatesAsA: many(matchCandidate, { relationName: 'asCandidateA' }),
  matchCandidatesAsB: many(matchCandidate, { relationName: 'asCandidateB' }),
  media: many(personMedia),
  mergedTarget: one(person, {
    fields: [person.mergedInto],
    references: [person.personId],
  }),
}));

export const personMediaRelations = relations(personMedia, ({ one }) => ({
  person: one(person, {
    fields: [personMedia.personId],
    references: [person.personId],
  }),
}));

export const matchCandidateRelations = relations(matchCandidate, ({ one }) => ({
  personA: one(person, {
    fields: [matchCandidate.personAId],
    references: [person.personId],
    relationName: 'asCandidateA',
  }),
  personB: one(person, {
    fields: [matchCandidate.personBId],
    references: [person.personId],
    relationName: 'asCandidateB',
  }),
}));

export const ancestorClosureRelations = relations(ancestorClosure, ({ one }) => ({
  descendant: one(person, {
    fields: [ancestorClosure.descendantId],
    references: [person.personId],
    relationName: 'asClosureDescendant',
  }),
  ancestor: one(person, {
    fields: [ancestorClosure.ancestorId],
    references: [person.personId],
    relationName: 'asClosureAncestor',
  }),
}));

export const sourceRelations = relations(source, ({ many }) => ({
  claims: many(personClaim),
  parentChildLinks: many(parentChild),
  partnerships: many(partnership),
}));

export const personClaimRelations = relations(personClaim, ({ one }) => ({
  person: one(person, {
    fields: [personClaim.personId],
    references: [person.personId],
  }),
  source: one(source, {
    fields: [personClaim.sourceId],
    references: [source.sourceId],
  }),
}));

export const parentChildRelations = relations(parentChild, ({ one }) => ({
  parent: one(person, {
    fields: [parentChild.parentId],
    references: [person.personId],
    relationName: 'asParent',
  }),
  child: one(person, {
    fields: [parentChild.childId],
    references: [person.personId],
    relationName: 'asChild',
  }),
  source: one(source, {
    fields: [parentChild.sourceId],
    references: [source.sourceId],
  }),
}));

export const partnershipRelations = relations(partnership, ({ one }) => ({
  person1: one(person, {
    fields: [partnership.person1Id],
    references: [person.personId],
    relationName: 'asPerson1',
  }),
  person2: one(person, {
    fields: [partnership.person2Id],
    references: [person.personId],
    relationName: 'asPerson2',
  }),
  source: one(source, {
    fields: [partnership.sourceId],
    references: [source.sourceId],
  }),
}));

