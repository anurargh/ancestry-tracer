import { db } from './index.ts';
import { ancestorClosure, parentChild, partnership, person, personClaim, source } from './schema.ts';
import { eq, and, or, inArray, asc } from 'drizzle-orm';
import {
  ParentChildLinkDetail,
  PartnershipDetail,
  PersonRecord,
  ParentChildRelationshipType,
  AncestorDetail,
  MRCAConnection,
  PathPersonNode,
  RelationshipResult,
} from '../types.ts';
import { getClaimsForPerson } from './people.ts';
import { recordAuditEntry } from './audit.ts';

/**
 * Returns a display name for a person ID from their active claims, or fallback ID
 */
export async function getPersonDisplayName(personId: string): Promise<string> {
  try {
    const claims = await db
      .select()
      .from(personClaim)
      .where(and(eq(personClaim.personId, personId), eq(personClaim.attributeType, 'name'), eq(personClaim.status, 'active')))
      .limit(1);

    if (claims[0]?.value) {
      return claims[0].value;
    }
    return `Person (${personId.slice(0, 8)})`;
  } catch {
    return `Person (${personId.slice(0, 8)})`;
  }
}

export interface CycleCheckResult {
  hasCycle: boolean;
  path: string[];
  pathNames?: string[];
  errorMessage?: string;
}

/**
 * Checks if adding an edge (parentId -> childId) would create a cycle.
 * A cycle occurs if `parentId` is already a descendant of `childId` (i.e. reachable from `childId`).
 * Rule: A person can never be their own ancestor.
 */
export async function checkParentChildCycle(
  parentId: string,
  childId: string
): Promise<CycleCheckResult> {
  // 1. Direct self-reference check
  if (parentId === childId) {
    const personName = await getPersonDisplayName(parentId);
    return {
      hasCycle: true,
      path: [parentId, childId],
      errorMessage: `Cannot link '${personName}' to themselves. A person can never be their own ancestor or parent.`,
    };
  }

  // 2. Query all existing parent_child relationships to build in-memory graph
  const allEdges = await db.select().from(parentChild);

  // Adjacency list: parent -> array of children
  const graph = new Map<string, string[]>();
  for (const edge of allEdges) {
    if (!graph.has(edge.parentId)) {
      graph.set(edge.parentId, []);
    }
    graph.get(edge.parentId)!.push(edge.childId);
  }

  // 3. BFS search from childId to check if parentId is reachable
  const queue: { nodeId: string; path: string[] }[] = [{ nodeId: childId, path: [childId] }];
  const visited = new Set<string>([childId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = graph.get(current.nodeId) || [];

    for (const nextChildId of children) {
      if (nextChildId === parentId) {
        // Cycle detected!
        const fullPath = [...current.path, nextChildId];
        
        // Resolve display names for each person along the cycle path
        const pathNames = await Promise.all(
          fullPath.map(async (id) => await getPersonDisplayName(id))
        );

        const parentName = pathNames[pathNames.length - 1];
        const childName = pathNames[0];
        const pathString = pathNames.join(' → ');

        return {
          hasCycle: true,
          path: fullPath,
          pathNames,
          errorMessage: `Genealogical Cycle Conflict: Cannot add '${parentName}' as a parent of '${childName}'. '${parentName}' is already recorded as a descendant of '${childName}' along the lineage path: [${pathString}]. A person can never be their own ancestor.`,
        };
      }

      if (!visited.has(nextChildId)) {
        visited.add(nextChildId);
        queue.push({
          nodeId: nextChildId,
          path: [...current.path, nextChildId],
        });
      }
    }
  }

  return { hasCycle: false, path: [] };
}

/**
 * =========================================================================
 * ANCESTOR CLOSURE INCREMENTAL RECOMPUTATION
 * =========================================================================
 *
 * Recomputes the ancestor_closure table incrementally when a parent_child edge
 * (parentId -> childId) is added or removed.
 *
 * In a genealogical DAG:
 * 1. An edge modification (parentId, childId) only alters the reachable ancestors
 *    for childId and all of childId's descendants.
 * 2. Ancestors of parentId, unlinked siblings, spouses, and other non-descendant
 *    branches are completely unaffected.
 * 3. Max generations tracked = 10.
 * 4. For multiple paths (e.g. cousin marriages / pedigree collapse), we use BFS
 *    to find and record the MINIMUM number of generations between descendant and ancestor.
 */
export async function recomputeAncestorClosureIncremental(
  parentId: string,
  childId: string
): Promise<{ affectedCount: number; updatedRows: number }> {
  // 1. Fetch all current parent_child edges
  const allEdges = await db.select().from(parentChild);

  // Build adjacency maps
  const parentToChildren = new Map<string, Set<string>>();
  const childToParents = new Map<string, Set<string>>();

  for (const edge of allEdges) {
    if (!parentToChildren.has(edge.parentId)) {
      parentToChildren.set(edge.parentId, new Set());
    }
    parentToChildren.get(edge.parentId)!.add(edge.childId);

    if (!childToParents.has(edge.childId)) {
      childToParents.set(edge.childId, new Set());
    }
    childToParents.get(edge.childId)!.add(edge.parentId);
  }

  // 2. Identify all affected descendants starting from childId (downward BFS)
  const affectedDescendants = new Set<string>([childId]);
  const descQueue: { personId: string; depth: number }[] = [{ personId: childId, depth: 0 }];

  while (descQueue.length > 0) {
    const { personId, depth } = descQueue.shift()!;
    if (depth >= 10) continue;

    const children = parentToChildren.get(personId) || new Set<string>();
    for (const cId of children) {
      if (!affectedDescendants.has(cId)) {
        affectedDescendants.add(cId);
        descQueue.push({ personId: cId, depth: depth + 1 });
      }
    }
  }

  const affectedList = Array.from(affectedDescendants);
  if (affectedList.length === 0) {
    return { affectedCount: 0, updatedRows: 0 };
  }

  // 3. For each affected descendant, compute all reachable ancestors up to 10 generations
  //    with the MINIMUM generations count (shortest path in DAG via BFS)
  const newClosureRows: { descendantId: string; ancestorId: string; generations: number }[] = [];

  for (const dId of affectedList) {
    const minGenerations = new Map<string, number>(); // ancestorId -> minimum generations
    const queue: { personId: string; depth: number }[] = [{ personId: dId, depth: 0 }];
    const bestDepth = new Map<string, number>(); // personId -> shortest depth reached
    bestDepth.set(dId, 0);

    while (queue.length > 0) {
      const { personId: current, depth } = queue.shift()!;
      if (depth >= 10) continue;

      const parents = childToParents.get(current) || new Set<string>();
      for (const pId of parents) {
        const nextDepth = depth + 1;

        // Record or update minimum generations (smaller count wins)
        const currentMin = minGenerations.get(pId);
        if (currentMin === undefined || nextDepth < currentMin) {
          minGenerations.set(pId, nextDepth);
        }

        // Only continue BFS traversal if we found a strictly shorter path to pId
        const prevSeenDepth = bestDepth.get(pId);
        if (prevSeenDepth === undefined || nextDepth < prevSeenDepth) {
          bestDepth.set(pId, nextDepth);
          queue.push({ personId: pId, depth: nextDepth });
        }
      }
    }

    // Accumulate rows for this descendant
    for (const [ancestorId, generations] of minGenerations.entries()) {
      newClosureRows.push({
        descendantId: dId,
        ancestorId,
        generations,
      });
    }
  }

  // 4. Incrementally update database ONLY for the affected descendants
  for (const dId of affectedList) {
    await db.delete(ancestorClosure).where(eq(ancestorClosure.descendantId, dId));
  }

  if (newClosureRows.length > 0) {
    // Insert in chunks of 50 to avoid parameter limit issues
    const chunkSize = 50;
    for (let i = 0; i < newClosureRows.length; i += chunkSize) {
      const chunk = newClosureRows.slice(i, i + chunkSize);
      await db.insert(ancestorClosure).values(chunk);
    }
  }

  return {
    affectedCount: affectedList.length,
    updatedRows: newClosureRows.length,
  };
}

/**
 * Rebuilds the entire ancestor_closure table from scratch across all people.
 */
export async function rebuildAllAncestorClosures(): Promise<{
  totalPeople: number;
  totalClosureRows: number;
}> {
  const allPeople = await db.select({ personId: person.personId }).from(person);
  const allEdges = await db.select().from(parentChild);

  const childToParents = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (!childToParents.has(edge.childId)) {
      childToParents.set(edge.childId, new Set());
    }
    childToParents.get(edge.childId)!.add(edge.parentId);
  }

  const allRows: { descendantId: string; ancestorId: string; generations: number }[] = [];

  for (const { personId } of allPeople) {
    const minGenerations = new Map<string, number>();
    const queue: { personId: string; depth: number }[] = [{ personId, depth: 0 }];
    const bestDepth = new Map<string, number>();
    bestDepth.set(personId, 0);

    while (queue.length > 0) {
      const { personId: current, depth } = queue.shift()!;
      if (depth >= 10) continue;

      const parents = childToParents.get(current) || new Set<string>();
      for (const pId of parents) {
        const nextDepth = depth + 1;

        const currentMin = minGenerations.get(pId);
        if (currentMin === undefined || nextDepth < currentMin) {
          minGenerations.set(pId, nextDepth);
        }

        const prevSeenDepth = bestDepth.get(pId);
        if (prevSeenDepth === undefined || nextDepth < prevSeenDepth) {
          bestDepth.set(pId, nextDepth);
          queue.push({ personId: pId, depth: nextDepth });
        }
      }
    }

    for (const [ancestorId, generations] of minGenerations.entries()) {
      allRows.push({
        descendantId: personId,
        ancestorId,
        generations,
      });
    }
  }

  // Clear table and reinsert
  await db.delete(ancestorClosure);

  if (allRows.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < allRows.length; i += chunkSize) {
      const chunk = allRows.slice(i, i + chunkSize);
      await db.insert(ancestorClosure).values(chunk);
    }
  }

  return {
    totalPeople: allPeople.length,
    totalClosureRows: allRows.length,
  };
}

/**
 * Returns all reachable ancestors for a given descendant up to 10 generations,
 * sorted by ascending generation count.
 */
export async function getAncestorsForPerson(personId: string): Promise<AncestorDetail[]> {
  const rows = await db
    .select({
      ancestorId: ancestorClosure.ancestorId,
      generations: ancestorClosure.generations,
    })
    .from(ancestorClosure)
    .where(eq(ancestorClosure.descendantId, personId))
    .orderBy(asc(ancestorClosure.generations));

  const results: AncestorDetail[] = await Promise.all(
    rows.map(async (row) => {
      const pRows = await db.select().from(person).where(eq(person.personId, row.ancestorId)).limit(1);
      const claims = await getClaimsForPerson(row.ancestorId);
      const ancestorPerson: PersonRecord = {
        personId: row.ancestorId,
        isLiving: pRows[0]?.isLiving ?? true,
        privacyLevel: pRows[0]?.privacyLevel ?? 'public',
        ancestryStatus: pRows[0]?.ancestryStatus ?? null,
        mergedInto: pRows[0]?.mergedInto ?? null,
        createdBy: pRows[0]?.createdBy ?? null,
        createdAt: pRows[0]?.createdAt ? pRows[0].createdAt.toISOString() : null,
        claims,
      };

      return {
        ancestorId: row.ancestorId,
        generations: row.generations,
        person: ancestorPerson,
      };
    })
  );

  return results;
}

export interface AddParentChildInput {
  parentId: string;
  childId: string;
  relationshipType: ParentChildRelationshipType | string;
  sourceType?: string;
  citation?: string;
  reliabilityTier?: number;
  confidence?: number;
}

export async function addParentChildRelationship(input: AddParentChildInput) {
  // 1. Cycle Detection
  const cycleCheck = await checkParentChildCycle(input.parentId, input.childId);
  if (cycleCheck.hasCycle) {
    throw new Error(cycleCheck.errorMessage || 'Adding this relationship would create an invalid genealogical cycle.');
  }

  // 2. Check if identical relationship already exists
  const existing = await db
    .select()
    .from(parentChild)
    .where(
      and(
        eq(parentChild.parentId, input.parentId),
        eq(parentChild.childId, input.childId),
        eq(parentChild.relationshipType, input.relationshipType)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`This ${input.relationshipType} parent-child relationship is already recorded.`);
  }

  // 3. Create Source Record if citation provided
  let sourceId: string | null = null;
  if (input.citation && input.citation.trim()) {
    const insertedSource = await db
      .insert(source)
      .values({
        sourceType: input.sourceType || 'certificate',
        citation: input.citation.trim(),
        reliabilityTier: Number(input.reliabilityTier) || 4,
      })
      .returning();
    sourceId = insertedSource[0].sourceId;
  }

  // 4. Insert parent_child record
  const insertedLink = await db
    .insert(parentChild)
    .values({
      parentId: input.parentId,
      childId: input.childId,
      relationshipType: input.relationshipType,
      sourceId,
      confidence: Number(input.confidence) || 90,
    })
    .returning();

  const newLink = insertedLink[0];

  // Audit log parent_child insertion
  await recordAuditEntry({
    entityType: 'parent_child',
    entityId: `${input.parentId}:${input.childId}`,
    action: 'insert',
    oldValue: null,
    newValue: {
      parentId: input.parentId,
      childId: input.childId,
      relationshipType: input.relationshipType,
      sourceId,
      confidence: input.confidence || 90,
    },
    changedBy: 'user',
  });

  // 5. Incremental ancestor_closure recomputation for affected descendants
  try {
    await recomputeAncestorClosureIncremental(input.parentId, input.childId);
  } catch (closureErr) {
    console.error('Error recomputing ancestor closure incrementally:', closureErr);
  }

  return newLink;
}

export async function removeParentChildRelationship(
  parentId: string,
  childId: string,
  relationshipType: string,
  changedBy = 'user'
) {
  const deleted = await db
    .delete(parentChild)
    .where(
      and(
        eq(parentChild.parentId, parentId),
        eq(parentChild.childId, childId),
        eq(parentChild.relationshipType, relationshipType)
      )
    )
    .returning();

  if (deleted.length > 0) {
    // Audit log parent_child deletion
    await recordAuditEntry({
      entityType: 'parent_child',
      entityId: `${parentId}:${childId}`,
      action: 'delete',
      oldValue: {
        parentId,
        childId,
        relationshipType,
      },
      newValue: null,
      changedBy,
    });

    // Incremental ancestor_closure recomputation for affected descendants
    try {
      await recomputeAncestorClosureIncremental(parentId, childId);
    } catch (closureErr) {
      console.error('Error updating ancestor closure on edge removal:', closureErr);
    }
  }

  return deleted[0];
}

export interface AddPartnershipInput {
  person1Id: string;
  person2Id: string;
  unionType?: string;
  startDate?: string;
  endDate?: string;
  sourceType?: string;
  citation?: string;
  reliabilityTier?: number;
}

export async function addPartnership(input: AddPartnershipInput) {
  if (input.person1Id === input.person2Id) {
    throw new Error('A person cannot form a partnership with themselves.');
  }

  // Check if existing partnership between these two exists
  const existing = await db
    .select()
    .from(partnership)
    .where(
      or(
        and(eq(partnership.person1Id, input.person1Id), eq(partnership.person2Id, input.person2Id)),
        and(eq(partnership.person1Id, input.person2Id), eq(partnership.person2Id, input.person1Id))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('A partnership between these two individuals is already recorded.');
  }

  // Create Source Record if citation provided
  let sourceId: string | null = null;
  if (input.citation && input.citation.trim()) {
    const insertedSource = await db
      .insert(source)
      .values({
        sourceType: input.sourceType || 'certificate',
        citation: input.citation.trim(),
        reliabilityTier: Number(input.reliabilityTier) || 4,
      })
      .returning();
    sourceId = insertedSource[0].sourceId;
  }

  // Insert partnership
  const insertedPartnership = await db
    .insert(partnership)
    .values({
      person1Id: input.person1Id,
      person2Id: input.person2Id,
      unionType: input.unionType || 'marriage',
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      sourceId,
    })
    .returning();

  const newPartnership = insertedPartnership[0];

  // Audit log partnership insertion
  await recordAuditEntry({
    entityType: 'partnership',
    entityId: newPartnership.partnershipId,
    action: 'insert',
    oldValue: null,
    newValue: {
      partnershipId: newPartnership.partnershipId,
      person1Id: input.person1Id,
      person2Id: input.person2Id,
      unionType: newPartnership.unionType,
      startDate: newPartnership.startDate,
      endDate: newPartnership.endDate,
    },
    changedBy: 'user',
  });

  return newPartnership;
}

export async function removePartnership(partnershipId: string, changedBy = 'user') {
  const existing = await db
    .select()
    .from(partnership)
    .where(eq(partnership.partnershipId, partnershipId));

  const deleted = await db
    .delete(partnership)
    .where(eq(partnership.partnershipId, partnershipId))
    .returning();

  if (deleted.length > 0 && existing.length > 0) {
    await recordAuditEntry({
      entityType: 'partnership',
      entityId: partnershipId,
      action: 'delete',
      oldValue: {
        partnershipId,
        person1Id: existing[0].person1Id,
        person2Id: existing[0].person2Id,
        unionType: existing[0].unionType,
      },
      newValue: null,
      changedBy,
    });
  }

  return deleted[0];
}

/**
 * Loads parents, children, and partnerships with full person records and claims
 */
export async function getFamilyForPerson(personId: string) {
  // 1. Get Parents (where child_id = personId)
  const parentRows = await db
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
    .where(eq(parentChild.childId, personId));

  const parents: ParentChildLinkDetail[] = await Promise.all(
    parentRows.map(async (row) => {
      const pRows = await db.select().from(person).where(eq(person.personId, row.parentId)).limit(1);
      const claims = await getClaimsForPerson(row.parentId);
      const parentEntity: PersonRecord = {
        personId: row.parentId,
        isLiving: pRows[0]?.isLiving ?? true,
        privacyLevel: pRows[0]?.privacyLevel ?? 'public',
        ancestryStatus: pRows[0]?.ancestryStatus ?? null,
        mergedInto: pRows[0]?.mergedInto ?? null,
        createdBy: pRows[0]?.createdBy ?? null,
        createdAt: pRows[0]?.createdAt ? pRows[0].createdAt.toISOString() : null,
        claims,
      };

      return {
        parentId: row.parentId,
        childId: row.childId,
        relationshipType: row.relationshipType as ParentChildRelationshipType,
        sourceId: row.sourceId,
        confidence: row.confidence,
        person: parentEntity,
        source: row.source?.sourceId ? row.source : null,
      };
    })
  );

  // 2. Get Children (where parent_id = personId)
  const childRows = await db
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
    .where(eq(parentChild.parentId, personId));

  const children: ParentChildLinkDetail[] = await Promise.all(
    childRows.map(async (row) => {
      const pRows = await db.select().from(person).where(eq(person.personId, row.childId)).limit(1);
      const claims = await getClaimsForPerson(row.childId);
      const childEntity: PersonRecord = {
        personId: row.childId,
        isLiving: pRows[0]?.isLiving ?? true,
        privacyLevel: pRows[0]?.privacyLevel ?? 'public',
        ancestryStatus: pRows[0]?.ancestryStatus ?? null,
        mergedInto: pRows[0]?.mergedInto ?? null,
        createdBy: pRows[0]?.createdBy ?? null,
        createdAt: pRows[0]?.createdAt ? pRows[0].createdAt.toISOString() : null,
        claims,
      };

      return {
        parentId: row.parentId,
        childId: row.childId,
        relationshipType: row.relationshipType as ParentChildRelationshipType,
        sourceId: row.sourceId,
        confidence: row.confidence,
        person: childEntity,
        source: row.source?.sourceId ? row.source : null,
      };
    })
  );

  // 3. Get Partnerships (where person1_id = personId OR person2_id = personId)
  const partnershipRows = await db
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
    .where(or(eq(partnership.person1Id, personId), eq(partnership.person2Id, personId)));

  const partnerships: PartnershipDetail[] = await Promise.all(
    partnershipRows.map(async (row) => {
      const partnerId = row.person1Id === personId ? row.person2Id : row.person1Id;
      const pRows = await db.select().from(person).where(eq(person.personId, partnerId)).limit(1);
      const claims = await getClaimsForPerson(partnerId);
      const partnerEntity: PersonRecord = {
        personId: partnerId,
        isLiving: pRows[0]?.isLiving ?? true,
        privacyLevel: pRows[0]?.privacyLevel ?? 'public',
        ancestryStatus: pRows[0]?.ancestryStatus ?? null,
        mergedInto: pRows[0]?.mergedInto ?? null,
        createdBy: pRows[0]?.createdBy ?? null,
        createdAt: pRows[0]?.createdAt ? pRows[0].createdAt.toISOString() : null,
        claims,
      };

      return {
        partnershipId: row.partnershipId,
        person1Id: row.person1Id,
        person2Id: row.person2Id,
        partner: partnerEntity,
        unionType: row.unionType,
        startDate: row.startDate,
        endDate: row.endDate,
        sourceId: row.sourceId,
        source: row.source?.sourceId ? row.source : null,
      };
    })
  );

  return { parents, children, partnerships };
}

/**
 * Format ordinal number: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", etc.
 */
export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Computes the kinship relationship label from two generation distances:
 * genA: generation distance from Person A to common ancestor (or 0 if A is ancestor of B)
 * genB: generation distance from Person B to common ancestor (or 0 if B is ancestor of A)
 * isHalf: whether this is through a single common ancestor rather than a full couple
 */
export function computeRelationshipLabel(
  genA: number,
  genB: number,
  isHalf: boolean
): string {
  const prefix = isHalf ? 'Half-' : '';

  // Case 0: Same person
  if (genA === 0 && genB === 0) {
    return 'Self (Same Person)';
  }

  // Case 1: Direct descendant/ancestor (one of genA or genB is 0)
  if (genA === 0 || genB === 0) {
    const d = Math.max(genA, genB);
    const isAAncestorOfB = genA === 0; // A is ancestor of B, B is descendant of A

    let baseLabel = '';
    if (d === 1) {
      baseLabel = isAAncestorOfB ? 'Parent' : 'Child';
    } else if (d === 2) {
      baseLabel = isAAncestorOfB ? 'Grandparent' : 'Grandchild';
    } else if (d === 3) {
      baseLabel = isAAncestorOfB ? 'Great-Grandparent' : 'Great-Grandchild';
    } else if (d > 3) {
      const greatCount = d - 2;
      const greatPrefix = greatCount === 2 ? '2nd Great-' : greatCount === 3 ? '3rd Great-' : `${formatOrdinal(greatCount)} Great-`;
      baseLabel = isAAncestorOfB ? `${greatPrefix}Grandparent` : `${greatPrefix}Grandchild`;
    }
    return baseLabel; // Direct ancestors/descendants don't use "half"
  }

  // Case 2: Siblings (genA = 1, genB = 1)
  if (genA === 1 && genB === 1) {
    return `${prefix}Sibling`;
  }

  // Case 3: Aunt/Uncle or Niece/Nephew (1 & n where n >= 2)
  if (genA === 1 || genB === 1) {
    const maxGen = Math.max(genA, genB);
    const isACloser = genA === 1; // Ancestor is parent of A, meaning A is aunt/uncle of B; B is niece/nephew of A
    const k = maxGen - 2; // k=0 for aunt/uncle (gen 2), k=1 for great-aunt/uncle (gen 3), k=2 for 2nd great-aunt/uncle (gen 4)

    let greatPrefix = '';
    if (k === 1) {
      greatPrefix = 'Great-';
    } else if (k === 2) {
      greatPrefix = '2nd Great-';
    } else if (k > 2) {
      greatPrefix = `${formatOrdinal(k)} Great-`;
    }

    if (isACloser) {
      // From perspective of A: A is Aunt/Uncle of B
      return `${prefix}${greatPrefix}Aunt/Uncle`;
    } else {
      // From perspective of A: A is Niece/Nephew of B
      return `${prefix}${greatPrefix}Niece/Nephew`;
    }
  }

  // Case 4: Cousins (both genA >= 2 and genB >= 2)
  const minGen = Math.min(genA, genB);
  const diff = Math.abs(genA - genB);
  const cousinDegree = minGen - 1; // min - 1
  const cousinOrdinal = formatOrdinal(cousinDegree);

  let removedPart = '';
  if (diff === 1) {
    removedPart = ', Once Removed';
  } else if (diff === 2) {
    removedPart = ', Twice Removed';
  } else if (diff === 3) {
    removedPart = ', 3 Times Removed';
  } else if (diff > 3) {
    removedPart = `, ${diff} Times Removed`;
  }

  return `${prefix}${cousinOrdinal} Cousin${removedPart}`;
}

/**
 * Finds shortest ancestor path from targetPersonId to ancestorId
 */
async function findAncestorPath(
  targetPersonId: string,
  ancestorId: string,
  allEdges: { parentId: string; childId: string }[]
): Promise<PathPersonNode[]> {
  if (targetPersonId === ancestorId) {
    const name = await getPersonDisplayName(targetPersonId);
    return [{ personId: targetPersonId, name, generationDistance: 0 }];
  }

  const childToParents = new Map<string, string[]>();
  for (const edge of allEdges) {
    if (!childToParents.has(edge.childId)) {
      childToParents.set(edge.childId, []);
    }
    childToParents.get(edge.childId)!.push(edge.parentId);
  }

  // BFS to find shortest path of person IDs from targetPersonId to ancestorId
  const queue: string[][] = [[targetPersonId]];
  const visited = new Set<string>([targetPersonId]);
  let foundPath: string[] | null = null;

  while (queue.length > 0) {
    const currPath = queue.shift()!;
    const last = currPath[currPath.length - 1];

    if (last === ancestorId) {
      foundPath = currPath;
      break;
    }

    if (currPath.length > 11) continue; // Max depth 10 generations

    const parents = childToParents.get(last) || [];
    for (const p of parents) {
      if (!visited.has(p)) {
        visited.add(p);
        queue.push([...currPath, p]);
      }
    }
  }

  if (!foundPath) {
    const targetName = await getPersonDisplayName(targetPersonId);
    const ancName = await getPersonDisplayName(ancestorId);
    return [
      { personId: targetPersonId, name: targetName, generationDistance: 0 },
      { personId: ancestorId, name: ancName, generationDistance: 1 },
    ];
  }

  // Build path nodes with resolved names
  const pathNodes: PathPersonNode[] = [];
  for (let i = 0; i < foundPath.length; i++) {
    const pId = foundPath[i];
    const name = await getPersonDisplayName(pId);
    pathNodes.push({
      personId: pId,
      name,
      generationDistance: i,
    });
  }

  return pathNodes;
}

/**
 * =========================================================================
 * "HOW AM I RELATED TO X?" (RELATIONSHIP CALCULATOR)
 * =========================================================================
 *
 * Given two person IDs (personA and personB):
 * 1. Query ancestor_closure for personA and personB.
 *    (Include personA itself with distance 0 if personB has personA as ancestor, and vice versa).
 * 2. Find every ancestor common to both by intersecting their ancestor_closure sets.
 * 3. Keep only Most Recent Common Ancestors (MRCAs) by dropping any common ancestor
 *    that is itself an ancestor of another common ancestor in ancestor_closure.
 * 4. Fetch partnerships to detect if pairs of MRCAs form a couple / marriage.
 *    - If both members of a couple are shared ancestors through the same paths, group them
 *      and report the relationship once (e.g. "Paternal Grandparents").
 *    - If only one member of a couple is shared (or unpartnered), label it "Half-".
 * 5. Compute relationship label from generation distances (genA, genB):
 *    - 0 & d = Direct Child / Parent / Grandparent / Grandchild
 *    - 1 & 1 = Siblings
 *    - 1 & n = Aunt/Uncle or Niece/Nephew with Great- prefixes
 *    - Both >= 2 = (min - 1)th Cousins, removed by difference
 * 6. Construct full explanation path showing names and ancestor chains.
 */
export async function calculateRelationshipBetween(
  personAId: string,
  personBId: string
): Promise<RelationshipResult> {
  // Fetch person entities
  const [pRowsA, pRowsB] = await Promise.all([
    db.select().from(person).where(eq(person.personId, personAId)).limit(1),
    db.select().from(person).where(eq(person.personId, personBId)).limit(1),
  ]);

  if (!pRowsA[0] || !pRowsB[0]) {
    throw new Error('One or both persons not found');
  }

  const [claimsA, claimsB] = await Promise.all([
    getClaimsForPerson(personAId),
    getClaimsForPerson(personBId),
  ]);

  const nameA = await getPersonDisplayName(personAId);
  const nameB = await getPersonDisplayName(personBId);

  const personA: PersonRecord & { displayName: string } = {
    personId: personAId,
    displayName: nameA,
    isLiving: pRowsA[0].isLiving,
    privacyLevel: pRowsA[0].privacyLevel,
    ancestryStatus: pRowsA[0].ancestryStatus,
    mergedInto: pRowsA[0].mergedInto,
    createdBy: pRowsA[0].createdBy,
    createdAt: pRowsA[0].createdAt ? pRowsA[0].createdAt.toISOString() : null,
    claims: claimsA,
  };

  const personB: PersonRecord & { displayName: string } = {
    personId: personBId,
    displayName: nameB,
    isLiving: pRowsB[0].isLiving,
    privacyLevel: pRowsB[0].privacyLevel,
    ancestryStatus: pRowsB[0].ancestryStatus,
    mergedInto: pRowsB[0].mergedInto,
    createdBy: pRowsB[0].createdBy,
    createdAt: pRowsB[0].createdAt ? pRowsB[0].createdAt.toISOString() : null,
    claims: claimsB,
  };

  // Check if identical
  if (personAId === personBId) {
    return {
      personA,
      personB,
      areIdentical: true,
      connections: [],
      summaryMessage: `${nameA} is the same person as ${nameB}.`,
    };
  }

  // 1. Fetch ancestor closure rows for personA and personB
  const [closureA, closureB, allClosure] = await Promise.all([
    db.select().from(ancestorClosure).where(eq(ancestorClosure.descendantId, personAId)),
    db.select().from(ancestorClosure).where(eq(ancestorClosure.descendantId, personBId)),
    db.select().from(ancestorClosure), // Needed to check ancestry between common ancestors
  ]);

  // Map of ancestorId -> generations distance
  const ancestorsMapA = new Map<string, number>();
  for (const row of closureA) {
    ancestorsMapA.set(row.ancestorId, row.generations);
  }

  const ancestorsMapB = new Map<string, number>();
  for (const row of closureB) {
    ancestorsMapB.set(row.ancestorId, row.generations);
  }

  // Build closure reachability map: isAncestorOf.get(X)?.has(Y) -> X is an ancestor of Y
  // (In closure table: descendantId has ancestorId, so ancestorId is ancestor of descendantId)
  const isAncestorOf = new Map<string, Set<string>>();
  for (const row of allClosure) {
    if (!isAncestorOf.has(row.ancestorId)) {
      isAncestorOf.set(row.ancestorId, new Set());
    }
    isAncestorOf.get(row.ancestorId)!.add(row.descendantId);
  }

  // Check direct ancestry:
  // Is personA an ancestor of personB?
  const isADescendantOfB = ancestorsMapA.has(personBId); // personB is ancestor of personA
  const isBDescendantOfA = ancestorsMapB.has(personAId); // personA is ancestor of personB

  // Set of common ancestor IDs
  const commonAncestorIds = new Set<string>();

  for (const ancId of ancestorsMapA.keys()) {
    if (ancestorsMapB.has(ancId)) {
      commonAncestorIds.add(ancId);
    }
  }

  // If personA is an ancestor of personB, personA itself is the MRCA
  if (isBDescendantOfA) {
    commonAncestorIds.add(personAId);
    ancestorsMapA.set(personAId, 0); // distance 0 from A to A
  }

  // If personB is an ancestor of personA, personB itself is the MRCA
  if (isADescendantOfB) {
    commonAncestorIds.add(personBId);
    ancestorsMapB.set(personBId, 0); // distance 0 from B to B
  }

  if (commonAncestorIds.size === 0) {
    return {
      personA,
      personB,
      areIdentical: false,
      connections: [],
      summaryMessage: `No common ancestor found between ${nameA} and ${nameB} within 10 generations.`,
    };
  }

  // 2. Filter to Most Recent Common Ancestors (MRCAs):
  // Drop any common ancestor C where C is an ancestor of some other common ancestor D in commonAncestorIds
  const mrcaIds = new Set<string>();
  const commonList = Array.from(commonAncestorIds);

  for (const c of commonList) {
    let isOlderAncestorOfAnotherShared = false;
    const cDescendants = isAncestorOf.get(c) || new Set<string>();

    for (const d of commonList) {
      if (c !== d && cDescendants.has(d)) {
        isOlderAncestorOfAnotherShared = true;
        break;
      }
    }

    if (!isOlderAncestorOfAnotherShared) {
      mrcaIds.add(c);
    }
  }

  const allEdges = await db.select().from(parentChild);
  const allPartnerships = await db.select().from(partnership);

  // Group MRCAs: If two MRCAs are married/partners and have identical generation distances (genDistanceA and genDistanceB),
  // they represent a full parental/ancestral couple for the same shared branch!
  const processedMRCAs = new Set<string>();
  const connections: MRCAConnection[] = [];

  const mrcaList = Array.from(mrcaIds);

  for (const mrcaId of mrcaList) {
    if (processedMRCAs.has(mrcaId)) continue;

    const genA = ancestorsMapA.get(mrcaId) ?? 0;
    const genB = ancestorsMapB.get(mrcaId) ?? 0;

    // Check if there is a partner of mrcaId that is ALSO in mrcaList with the same generation distances
    let partnerMRCAId: string | null = null;

    for (const p of allPartnerships) {
      let candidate: string | null = null;
      if (p.person1Id === mrcaId && mrcaIds.has(p.person2Id) && !processedMRCAs.has(p.person2Id)) {
        candidate = p.person2Id;
      } else if (p.person2Id === mrcaId && mrcaIds.has(p.person1Id) && !processedMRCAs.has(p.person1Id)) {
        candidate = p.person1Id;
      }

      if (candidate) {
        const pGenA = ancestorsMapA.get(candidate) ?? 0;
        const pGenB = ancestorsMapB.get(candidate) ?? 0;
        // Verify same branch generation distance
        if (pGenA === genA && pGenB === genB) {
          partnerMRCAId = candidate;
          break;
        }
      }
    }

    if (partnerMRCAId) {
      // FULL COUPLE COMMON ANCESTOR
      processedMRCAs.add(mrcaId);
      processedMRCAs.add(partnerMRCAId);

      const [anc1Entity, anc2Entity] = await Promise.all([
        db.select().from(person).where(eq(person.personId, mrcaId)).limit(1),
        db.select().from(person).where(eq(person.personId, partnerMRCAId)).limit(1),
      ]);
      const [claims1, claims2] = await Promise.all([
        getClaimsForPerson(mrcaId),
        getClaimsForPerson(partnerMRCAId),
      ]);
      const anc1Name = await getPersonDisplayName(mrcaId);
      const anc2Name = await getPersonDisplayName(partnerMRCAId);

      const [pathA1, pathB1, pathA2, pathB2] = await Promise.all([
        findAncestorPath(personAId, mrcaId, allEdges),
        findAncestorPath(personBId, mrcaId, allEdges),
        findAncestorPath(personAId, partnerMRCAId, allEdges),
        findAncestorPath(personBId, partnerMRCAId, allEdges),
      ]);

      const label = computeRelationshipLabel(genA, genB, false);
      const minGen = Math.min(genA, genB);
      const maxGen = Math.max(genA, genB);
      const removed = Math.abs(genA - genB);

      let explanation = '';
      if (genA === 0 || genB === 0) {
        const d = Math.max(genA, genB);
        explanation = genB === 0
          ? `${nameA} is a direct descendant of ${nameB} (${d} generation${d > 1 ? 's' : ''} removed).`
          : `${nameB} is a direct descendant of ${nameA} (${d} generation${d > 1 ? 's' : ''} removed).`;
      } else if (genA === 1 && genB === 1) {
        explanation = `${nameA} and ${nameB} share the couple ${anc1Name} & ${anc2Name} as common parents.`;
      } else {
        explanation = `${nameA} and ${nameB} share the couple ${anc1Name} & ${anc2Name} as common ancestors (${genA} gen from ${nameA}, ${genB} gen from ${nameB}).`;
      }

      connections.push({
        connectionId: `${mrcaId}_${partnerMRCAId}`,
        isCouple: true,
        isHalf: false,
        relationshipLabel: label,
        genDistanceA: genA,
        genDistanceB: genB,
        minGen,
        maxGen,
        removed,
        explanation,
        ancestor1: {
          personId: mrcaId,
          name: anc1Name,
          person: {
            personId: mrcaId,
            isLiving: anc1Entity[0]?.isLiving ?? true,
            privacyLevel: anc1Entity[0]?.privacyLevel ?? 'public',
            ancestryStatus: anc1Entity[0]?.ancestryStatus ?? null,
            mergedInto: anc1Entity[0]?.mergedInto ?? null,
            createdBy: anc1Entity[0]?.createdBy ?? null,
            createdAt: anc1Entity[0]?.createdAt ? anc1Entity[0].createdAt.toISOString() : null,
            claims: claims1,
          },
          genDistanceA: genA,
          genDistanceB: genB,
          pathA: pathA1,
          pathB: pathB1,
        },
        ancestor2: {
          personId: partnerMRCAId,
          name: anc2Name,
          person: {
            personId: partnerMRCAId,
            isLiving: anc2Entity[0]?.isLiving ?? true,
            privacyLevel: anc2Entity[0]?.privacyLevel ?? 'public',
            ancestryStatus: anc2Entity[0]?.ancestryStatus ?? null,
            mergedInto: anc2Entity[0]?.mergedInto ?? null,
            createdBy: anc2Entity[0]?.createdBy ?? null,
            createdAt: anc2Entity[0]?.createdAt ? anc2Entity[0].createdAt.toISOString() : null,
            claims: claims2,
          },
          genDistanceA: genA,
          genDistanceB: genB,
          pathA: pathA2,
          pathB: pathB2,
        },
      });
    } else {
      // SINGLE / HALF COMMON ANCESTOR (or direct ancestor)
      processedMRCAs.add(mrcaId);

      const ancEntity = await db.select().from(person).where(eq(person.personId, mrcaId)).limit(1);
      const claims = await getClaimsForPerson(mrcaId);
      const ancName = await getPersonDisplayName(mrcaId);

      const [pathA, pathB] = await Promise.all([
        findAncestorPath(personAId, mrcaId, allEdges),
        findAncestorPath(personBId, mrcaId, allEdges),
      ]);

      // If not direct parent/child/ancestor (both gen >= 1), and only 1 ancestor in MRCA without spouse, it's a Half relationship
      const isHalf = genA >= 1 && genB >= 1;
      const label = computeRelationshipLabel(genA, genB, isHalf);
      const minGen = Math.min(genA, genB);
      const maxGen = Math.max(genA, genB);
      const removed = Math.abs(genA - genB);

      let explanation = '';
      if (genA === 0 || genB === 0) {
        const d = Math.max(genA, genB);
        explanation = genB === 0
          ? `${nameA} is a direct descendant of ${nameB} (${d} generation${d > 1 ? 's' : ''} down).`
          : `${nameB} is a direct descendant of ${nameA} (${d} generation${d > 1 ? 's' : ''} down).`;
      } else if (genA === 1 && genB === 1) {
        explanation = `${nameA} and ${nameB} share ${ancName} as a single common parent (half-siblings).`;
      } else {
        explanation = `${nameA} and ${nameB} share ${ancName} as a common ancestor (${genA} gen from ${nameA}, ${genB} gen from ${nameB}).`;
      }

      connections.push({
        connectionId: mrcaId,
        isCouple: false,
        isHalf,
        relationshipLabel: label,
        genDistanceA: genA,
        genDistanceB: genB,
        minGen,
        maxGen,
        removed,
        explanation,
        ancestor1: {
          personId: mrcaId,
          name: ancName,
          person: {
            personId: mrcaId,
            isLiving: ancEntity[0]?.isLiving ?? true,
            privacyLevel: ancEntity[0]?.privacyLevel ?? 'public',
            ancestryStatus: ancEntity[0]?.ancestryStatus ?? null,
            mergedInto: ancEntity[0]?.mergedInto ?? null,
            createdBy: ancEntity[0]?.createdBy ?? null,
            createdAt: ancEntity[0]?.createdAt ? ancEntity[0].createdAt.toISOString() : null,
            claims,
          },
          genDistanceA: genA,
          genDistanceB: genB,
          pathA,
          pathB,
        },
      });
    }
  }

  // Sort connections by closest kinship (lowest sum of generations)
  connections.sort((a, b) => a.genDistanceA + a.genDistanceB - (b.genDistanceA + b.genDistanceB));

  const primaryLabel = connections[0]?.relationshipLabel || 'Related';
  const summaryMessage = `${nameA} is the ${primaryLabel.toLowerCase()} of ${nameB}.`;

  return {
    personA,
    personB,
    areIdentical: false,
    connections,
    summaryMessage,
  };
}
