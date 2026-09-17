import { db } from './index.ts';
import { person, personClaim, parentChild, partnership, source, tree, treeMember } from './schema.ts';
import { desc, eq, and, isNull, inArray, or } from 'drizzle-orm';
import { PersonRecord, PersonClaimRecord, ParentChildLinkDetail, PartnershipDetail } from '../types.ts';
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

    const accessibleTreeIds = memberships.map((m) => m.treeId);

    // If specific tree filter is passed
    let targetTreeCondition;
    if (filterTreeId) {
      targetTreeCondition = eq(person.treeId, filterTreeId);
    } else if (accessibleTreeIds.length > 0) {
      targetTreeCondition = or(
        inArray(person.treeId, accessibleTreeIds),
        eq(person.createdBy, userUid)
      );
    } else {
      targetTreeCondition = eq(person.createdBy, userUid);
    }

    const whereConditions = includeMerged
      ? targetTreeCondition
      : and(targetTreeCondition, isNull(person.mergedInto));

    const peopleList = await db
      .select()
      .from(person)
      .where(whereConditions)
      .orderBy(desc(person.createdAt));

    // Fetch claims with sources for each person
    const peopleWithClaims = await Promise.all(
      peopleList.map(async (p) => {
        const claimsWithSources = await getClaimsForPerson(p.personId);
        return {
          ...p,
          claims: claimsWithSources,
        };
      })
    );

    if (peopleWithClaims.length === 0) {
      return [];
    }

    const allPersonIds = peopleWithClaims.map((p) => p.personId);

    // Batch fetch parent_child relationships touching any of these people
    const pcRows = await db
      .select({
        parentId: parentChild.parentId,
        childId: parentChild.childId,
        relationshipType: parentChild.relationshipType,
        sourceId: parentChild.sourceId,
        confidence: parentChild.confidence,
        source: {
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          citation: source.citation,
          reliabilityTier: source.reliabilityTier,
        },
      })
      .from(parentChild)
      .leftJoin(source, eq(parentChild.sourceId, source.sourceId))
      .where(
        or(
          inArray(parentChild.parentId, allPersonIds),
          inArray(parentChild.childId, allPersonIds)
        )
      );

    // Batch fetch partnerships touching any of these people
    const pshipRows = await db
      .select({
        partnershipId: partnership.partnershipId,
        person1Id: partnership.person1Id,
        person2Id: partnership.person2Id,
        unionType: partnership.unionType,
        startDate: partnership.startDate,
        endDate: partnership.endDate,
        sourceId: partnership.sourceId,
        source: {
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          citation: source.citation,
          reliabilityTier: source.reliabilityTier,
        },
      })
      .from(partnership)
      .leftJoin(source, eq(partnership.sourceId, source.sourceId))
      .where(
        or(
          inArray(partnership.person1Id, allPersonIds),
          inArray(partnership.person2Id, allPersonIds)
        )
      );

    // Build a map of PersonRecord entities for linking
    const personMap = new Map<string, PersonRecord>();
    for (const p of peopleWithClaims) {
      personMap.set(p.personId, {
        personId: p.personId,
        treeId: p.treeId,
        isLiving: p.isLiving,
        privacyLevel: p.privacyLevel,
        ancestryStatus: p.ancestryStatus,
        mergedInto: p.mergedInto,
        createdBy: p.createdBy,
        createdAt: p.createdAt ? (p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt)) : null,
        claims: p.claims,
      });
    }

    // Check if there are any relative IDs not in personMap
    const missingRelativeIds = new Set<string>();
    for (const row of pcRows) {
      if (!personMap.has(row.parentId)) missingRelativeIds.add(row.parentId);
      if (!personMap.has(row.childId)) missingRelativeIds.add(row.childId);
    }
    for (const row of pshipRows) {
      if (!personMap.has(row.person1Id)) missingRelativeIds.add(row.person1Id);
      if (!personMap.has(row.person2Id)) missingRelativeIds.add(row.person2Id);
    }

    if (missingRelativeIds.size > 0) {
      const extraPeople = await db
        .select()
        .from(person)
        .where(inArray(person.personId, Array.from(missingRelativeIds)));

      for (const ep of extraPeople) {
        const claims = await getClaimsForPerson(ep.personId);
        personMap.set(ep.personId, {
          personId: ep.personId,
          treeId: ep.treeId,
          isLiving: ep.isLiving,
          privacyLevel: ep.privacyLevel,
          ancestryStatus: ep.ancestryStatus,
          mergedInto: ep.mergedInto,
          createdBy: ep.createdBy,
          createdAt: ep.createdAt ? (ep.createdAt instanceof Date ? ep.createdAt.toISOString() : String(ep.createdAt)) : null,
          claims,
        });
      }
    }

    // Attach parents, children, and partnerships to each person in peopleWithClaims
    const peopleWithLineage = peopleWithClaims.map((p) => {
      const pid = p.personId;

      const parents: ParentChildLinkDetail[] = pcRows
        .filter((r) => r.childId === pid)
        .map((r) => ({
          parentId: r.parentId,
          childId: r.childId,
          relationshipType: r.relationshipType,
          sourceId: r.sourceId,
          confidence: r.confidence,
          person: personMap.get(r.parentId) || ({ personId: r.parentId, claims: [] } as PersonRecord),
          source: r.source?.sourceId ? r.source : null,
        }));

      const children: ParentChildLinkDetail[] = pcRows
        .filter((r) => r.parentId === pid)
        .map((r) => ({
          parentId: r.parentId,
          childId: r.childId,
          relationshipType: r.relationshipType,
          sourceId: r.sourceId,
          confidence: r.confidence,
          person: personMap.get(r.childId) || ({ personId: r.childId, claims: [] } as PersonRecord),
          source: r.source?.sourceId ? r.source : null,
        }));

      const partnerships: PartnershipDetail[] = pshipRows
        .filter((r) => r.person1Id === pid || r.person2Id === pid)
        .map((r) => {
          const partnerId = r.person1Id === pid ? r.person2Id : r.person1Id;
          return {
            partnershipId: r.partnershipId,
            person1Id: r.person1Id,
            person2Id: r.person2Id,
            partner: personMap.get(partnerId) || ({ personId: partnerId, claims: [] } as PersonRecord),
            unionType: r.unionType,
            startDate: r.startDate,
            endDate: r.endDate,
            sourceId: r.sourceId,
            source: r.source?.sourceId ? r.source : null,
          };
        });

      return {
        ...p,
        createdAt: p.createdAt ? (p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt)) : null,
        parents,
        children,
        partnerships,
      };
    });

    return peopleWithLineage;
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
