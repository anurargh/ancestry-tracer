import { db } from './index.ts';
import { person, personClaim, source, tree, treeMember } from './schema.ts';
import { desc, eq, and, isNull, inArray, or } from 'drizzle-orm';
import { PersonRecord, PersonClaimRecord } from '../types.ts';
import { generateMatchCandidatesForPerson } from './duplicateDetection.ts';
import { ensureUserHasDefaultTree, getUserRoleForPerson } from './trees.ts';
import { recordAuditEntry } from './audit.ts';
import { getMediaForPerson } from './media.ts';

export interface InitialClaimInput {
  attributeType: string;
  value: string;
  sourceType: string;
  citation: string;
  reliabilityTier: number;
  confidence: number;
}

export interface CreatePersonInput {
  treeId?: string;
  isLiving?: boolean;
  privacyLevel?: string;
  ancestryStatus?: string;
  createdBy?: string;
  claims?: InitialClaimInput[];
}

export async function createPersonWithClaims(input: CreatePersonInput) {
  try {
    let assignedTreeId = input.treeId;
    if (!assignedTreeId && input.createdBy) {
      const defaultTree = await ensureUserHasDefaultTree(input.createdBy);
      assignedTreeId = defaultTree.treeId;
    }

    const isLiving = input.isLiving ?? true;
    // Living persons default to 'family_only' privacy level
    const privacyLevel = input.privacyLevel || (isLiving ? 'family_only' : 'public');

    // 1. Insert person entity
    const insertedPerson = await db
      .insert(person)
      .values({
        treeId: assignedTreeId || null,
        isLiving,
        privacyLevel,
        ancestryStatus: input.ancestryStatus || 'unverified',
        createdBy: input.createdBy || null,
      })
      .returning();

    const createdPerson = insertedPerson[0];

    // Audit log person creation
    await recordAuditEntry({
      entityType: 'person',
      entityId: createdPerson.personId,
      action: 'create',
      oldValue: null,
      newValue: {
        personId: createdPerson.personId,
        treeId: createdPerson.treeId,
        isLiving: createdPerson.isLiving,
        privacyLevel: createdPerson.privacyLevel,
        ancestryStatus: createdPerson.ancestryStatus,
      },
      changedBy: input.createdBy || 'user',
    });

    // 2. Insert claims if any provided
    if (input.claims && input.claims.length > 0) {
      for (const c of input.claims) {
        if (!c.value || !c.value.trim()) continue;

        // Create source record
        const insertedSource = await db
          .insert(source)
          .values({
            sourceType: c.sourceType || 'user_assertion',
            citation: c.citation || 'Initial person entry citation',
            reliabilityTier: Number(c.reliabilityTier) || 3,
          })
          .returning();

        const createdSource = insertedSource[0];

        // Create claim
        const insertedClaim = await db.insert(personClaim).values({
          personId: createdPerson.personId,
          attributeType: c.attributeType,
          value: c.value.trim(),
          sourceId: createdSource.sourceId,
          confidence: Number(c.confidence) || 80,
          submittedBy: input.createdBy || 'user',
          status: 'active',
        }).returning();

        if (insertedClaim[0]) {
          await recordAuditEntry({
            entityType: 'person_claim',
            entityId: insertedClaim[0].claimId,
            action: 'insert',
            oldValue: null,
            newValue: {
              personId: createdPerson.personId,
              attributeType: c.attributeType,
              value: c.value.trim(),
              sourceId: createdSource.sourceId,
              confidence: Number(c.confidence) || 80,
            },
            changedBy: input.createdBy || 'user',
          });
        }
      }
    }

    // Automatically trigger duplicate match candidate evaluation for this new person
    try {
      await generateMatchCandidatesForPerson(createdPerson.personId);
    } catch (candErr) {
      console.warn('Could not generate duplicate candidates for new person:', candErr);
    }

    return await getPersonById(createdPerson.personId);
  } catch (error) {
    console.error('Failed to create person with claims in PostgreSQL:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getPeopleForUser(userUid: string, includeMerged = false, filterTreeId?: string) {
  try {
    // 1. Find all tree IDs where user is owner, editor, or viewer
    const memberships = await db
      .select({ treeId: treeMember.treeId })
      .from(treeMember)
      .where(eq(treeMember.userUid, userUid));

    const memberTreeIds = memberships.map((m) => m.treeId);

    // 2. Find all discoverable / public archival trees
    const discoverableTrees = await db
      .select({ treeId: tree.treeId })
      .from(tree)
      .where(eq(tree.isDiscoverable, true));

    const discoverableTreeIds = discoverableTrees.map((t) => t.treeId);
    const allAccessibleTreeIds = Array.from(new Set([...memberTreeIds, ...discoverableTreeIds]));

    // If specific tree filter is passed
    let targetTreeCondition;
    if (filterTreeId) {
      targetTreeCondition = eq(person.treeId, filterTreeId);
    } else {
      const orClauses = [];
      if (allAccessibleTreeIds.length > 0) {
        orClauses.push(inArray(person.treeId, allAccessibleTreeIds));
      }
      orClauses.push(eq(person.createdBy, userUid));
      orClauses.push(eq(person.privacyLevel, 'public'));

      targetTreeCondition = orClauses.length === 1 ? orClauses[0] : or(...orClauses);
    }

    const whereConditions = includeMerged
      ? targetTreeCondition
      : and(targetTreeCondition, isNull(person.mergedInto));

    const peopleList = await db
      .select()
      .from(person)
      .where(whereConditions)
      .orderBy(desc(person.createdAt));

    // Filter living private records if user does not have member or creator access
    const memberTreeSet = new Set(memberTreeIds);
    const visiblePeople = peopleList.filter((p) => {
      // Deceased persons or public living persons are open archival records
      if (!p.isLiving || p.privacyLevel === 'public') {
        return true;
      }
      // Living person: user must be tree member or creator
      if (p.createdBy === userUid) return true;
      if (p.treeId && memberTreeSet.has(p.treeId)) return true;
      return false;
    });

    // Fetch claims with sources for each person
    const peopleWithClaims = await Promise.all(
      visiblePeople.map(async (p) => {
        const claimsWithSources = await getClaimsForPerson(p.personId);
        return {
          ...p,
          claims: claimsWithSources,
        };
      })
    );

    return peopleWithClaims;
  } catch (error) {
    console.error('Failed to get people records:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getClaimsForPerson(personId: string): Promise<PersonClaimRecord[]> {
  try {
    const claims = await db
      .select({
        claimId: personClaim.claimId,
        personId: personClaim.personId,
        attributeType: personClaim.attributeType,
        value: personClaim.value,
        sourceId: personClaim.sourceId,
        confidence: personClaim.confidence,
        submittedBy: personClaim.submittedBy,
        submittedAt: personClaim.submittedAt,
        status: personClaim.status,
        source: {
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          citation: source.citation,
          reliabilityTier: source.reliabilityTier,
        },
      })
      .from(personClaim)
      .leftJoin(source, eq(personClaim.sourceId, source.sourceId))
      .where(eq(personClaim.personId, personId))
      .orderBy(desc(personClaim.submittedAt));

    return claims.map((c) => ({
      claimId: c.claimId,
      personId: c.personId,
      attributeType: c.attributeType,
      value: c.value,
      sourceId: c.sourceId,
      confidence: c.confidence,
      submittedBy: c.submittedBy,
      submittedAt: c.submittedAt ? c.submittedAt.toISOString() : null,
      status: c.status || 'active',
      source: c.source?.sourceId ? c.source : null,
    }));
  } catch (error) {
    console.error('Failed to get claims for person:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getPersonById(personId: string): Promise<PersonRecord | null> {
  try {
    const rows = await db.select().from(person).where(eq(person.personId, personId)).limit(1);
    if (!rows[0]) return null;

    const p = rows[0];
    const [claims, media] = await Promise.all([
      getClaimsForPerson(personId),
      getMediaForPerson(personId),
    ]);

    return {
      personId: p.personId,
      treeId: p.treeId,
      isLiving: p.isLiving,
      privacyLevel: p.privacyLevel,
      ancestryStatus: p.ancestryStatus,
      mergedInto: p.mergedInto,
      createdBy: p.createdBy,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      claims,
      media,
    };
  } catch (error) {
    console.error('Failed to get person by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export interface AddClaimInput {
  personId: string;
  attributeType: string;
  value: string;
  sourceType: string;
  citation: string;
  reliabilityTier: number;
  confidence: number;
  submittedBy?: string;
  supersedeExistingActive?: boolean;
}

export async function addClaimToPerson(input: AddClaimInput) {
  try {
    // 1. If superseding existing active claims for this attribute
    if (input.supersedeExistingActive) {
      const activeClaims = await db
        .select()
        .from(personClaim)
        .where(
          and(
            eq(personClaim.personId, input.personId),
            eq(personClaim.attributeType, input.attributeType),
            eq(personClaim.status, 'active')
          )
        );

      await db
        .update(personClaim)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(personClaim.personId, input.personId),
            eq(personClaim.attributeType, input.attributeType),
            eq(personClaim.status, 'active')
          )
        );

      for (const oldClaim of activeClaims) {
        await recordAuditEntry({
          entityType: 'person_claim',
          entityId: oldClaim.claimId,
          action: 'supersede',
          oldValue: {
            personId: oldClaim.personId,
            attributeType: oldClaim.attributeType,
            value: oldClaim.value,
            status: 'active',
          },
          newValue: {
            personId: oldClaim.personId,
            attributeType: oldClaim.attributeType,
            value: oldClaim.value,
            status: 'superseded',
          },
          changedBy: input.submittedBy || 'user',
        });
      }
    }

    // 2. Insert source record
    const insertedSource = await db
      .insert(source)
      .values({
        sourceType: input.sourceType || 'user_assertion',
        citation: input.citation || 'User submitted claim citation',
        reliabilityTier: Number(input.reliabilityTier) || 3,
      })
      .returning();

    const createdSource = insertedSource[0];

    // 3. Insert new claim with status = 'active'
    const insertedClaim = await db
      .insert(personClaim)
      .values({
        personId: input.personId,
        attributeType: input.attributeType,
        value: input.value.trim(),
        sourceId: createdSource.sourceId,
        confidence: Number(input.confidence) || 80,
        submittedBy: input.submittedBy || 'user',
        status: 'active',
      })
      .returning();

    const newClaim = insertedClaim[0];

    // Audit log claim creation
    await recordAuditEntry({
      entityType: 'person_claim',
      entityId: newClaim.claimId,
      action: 'insert',
      oldValue: null,
      newValue: {
        personId: input.personId,
        attributeType: input.attributeType,
        value: input.value.trim(),
        sourceId: createdSource.sourceId,
        confidence: Number(input.confidence) || 80,
        status: 'active',
      },
      changedBy: input.submittedBy || 'user',
    });

    return {
      claim: newClaim,
      source: createdSource,
    };
  } catch (error) {
    console.error('Failed to add claim to person in PostgreSQL:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function markClaimSuperseded(claimId: string, changedBy = 'user') {
  try {
    const existing = await db
      .select()
      .from(personClaim)
      .where(eq(personClaim.claimId, claimId));

    const updated = await db
      .update(personClaim)
      .set({ status: 'superseded' })
      .where(eq(personClaim.claimId, claimId))
      .returning();

    if (updated[0] && existing[0]) {
      await recordAuditEntry({
        entityType: 'person_claim',
        entityId: claimId,
        action: 'supersede',
        oldValue: {
          personId: existing[0].personId,
          attributeType: existing[0].attributeType,
          value: existing[0].value,
          status: existing[0].status,
        },
        newValue: {
          personId: updated[0].personId,
          attributeType: updated[0].attributeType,
          value: updated[0].value,
          status: 'superseded',
        },
        changedBy,
      });
    }

    return updated[0];
  } catch (error) {
    console.error('Failed to supersede claim:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
