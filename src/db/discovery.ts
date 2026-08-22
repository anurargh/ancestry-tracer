import { db } from './index.ts';
import { person, tree, treeMember, users, matchCandidate } from './schema.ts';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import { getPersonById, getClaimsForPerson } from './people.ts';
import { evaluatePersonClaims } from '../utils/claims.ts';
import { checkPersonDiscoverableForUser, getMatchCandidates } from './duplicateDetection.ts';
import { calculateRelationshipBetween } from './relationships.ts';
import { PersonRecord, MRCAConnection } from '../types.ts';

export interface DiscoveryRelativeMatch {
  personId: string;
  name: string;
  isLiving: boolean;
  privacyLevel: string;
  birthDate?: string;
  birthPlace?: string;
  treeId: string | null;
  treeName?: string;
  ownerDisplayName?: string;
  score: number;
  band: 'strong' | 'possible' | 'unlikely';
  relationshipSummary?: string;
  connection?: MRCAConnection;
}

/**
 * Searches for discoverable relatives / duplicate matches across trees for a given person.
 * Zero Information Leakage:
 * - If a person is living, both searching user and living person's tree owner must have opted in.
 * - If not consented on either side, the match is SILENTLY dropped from results.
 * - No "hidden match" message or count is ever output.
 */
export async function searchRelativeDiscovery(
  targetPersonId: string,
  searchingUserUid: string
): Promise<{
  targetPerson: PersonRecord & { displayName: string };
  matches: DiscoveryRelativeMatch[];
  totalDiscovered: number;
  userOptedIn: boolean;
}> {
  const targetPerson = await getPersonById(targetPersonId);
  if (!targetPerson) {
    throw new Error('Target person not found');
  }

  // Check searching user's consent flag
  const userRows = await db
    .select({ optedIn: users.optedInDiscoverable })
    .from(users)
    .where(eq(users.uid, searchingUserUid))
    .limit(1);

  const userOptedIn = Boolean(userRows[0]?.optedIn);

  const targetEval = evaluatePersonClaims(targetPerson.claims || []);
  const targetName = targetEval['name']?.bestClaims[0]?.value || `Person (${targetPerson.personId.slice(0, 8)})`;

  // 1. Fetch match candidates where targetPerson is personA or personB
  const candidateRows = await db
    .select()
    .from(matchCandidate)
    .where(
      or(
        eq(matchCandidate.personAId, targetPersonId),
        eq(matchCandidate.personBId, targetPersonId)
      )
    )
    .orderBy(desc(matchCandidate.score));

  const discoveredMatches: DiscoveryRelativeMatch[] = [];

  for (const cand of candidateRows) {
    const relativeId = cand.personAId === targetPersonId ? cand.personBId : cand.personAId;
    const relativeRecord = await getPersonById(relativeId);
    if (!relativeRecord) continue;

    // Check discoverability under zero-information-leak privacy rules
    const isDiscoverable = await checkPersonDiscoverableForUser(relativeRecord, searchingUserUid);
    if (!isDiscoverable) {
      // SILENT EXCLUSION - Zero information leakage
      continue;
    }

    const relEval = evaluatePersonClaims(relativeRecord.claims || []);
    const relName = relEval['name']?.bestClaims[0]?.value || `Person (${relativeRecord.personId.slice(0, 8)})`;

    // Fetch tree name if present
    let treeName = 'Personal Tree';
    let ownerDisplayName = 'Tree Owner';

    if (relativeRecord.treeId) {
      const treeRows = await db
        .select({
          treeName: tree.name,
          ownerUid: tree.ownerUid,
          ownerName: users.displayName,
        })
        .from(tree)
        .leftJoin(users, eq(tree.ownerUid, users.uid))
        .where(eq(tree.treeId, relativeRecord.treeId))
        .limit(1);

      if (treeRows[0]) {
        treeName = treeRows[0].treeName;
        ownerDisplayName = treeRows[0].ownerName || 'Verified Tree Owner';
      }
    }

    // Try calculating kinship relationship
    let relationshipSummary: string | undefined;
    let primaryConnection: MRCAConnection | undefined;

    try {
      const relResult = await calculateRelationshipBetween(targetPersonId, relativeId);
      if (relResult && relResult.connections.length > 0) {
        relationshipSummary = relResult.summaryMessage;
        primaryConnection = relResult.connections[0];
      }
    } catch (e) {
      // ignore
    }

    discoveredMatches.push({
      personId: relativeRecord.personId,
      name: relName,
      isLiving: Boolean(relativeRecord.isLiving),
      privacyLevel: relativeRecord.privacyLevel || (relativeRecord.isLiving ? 'family_only' : 'public'),
      birthDate: relEval['birth_date']?.bestClaims[0]?.value,
      birthPlace: relEval['birth_place']?.bestClaims[0]?.value,
      treeId: relativeRecord.treeId || null,
      treeName,
      ownerDisplayName,
      score: cand.score,
      band: cand.band as 'strong' | 'possible' | 'unlikely',
      relationshipSummary,
      connection: primaryConnection,
    });
  }

  return {
    targetPerson: {
      ...targetPerson,
      displayName: targetName,
    },
    matches: discoveredMatches,
    totalDiscovered: discoveredMatches.length,
    userOptedIn,
  };
}

/**
 * Get privacy & discoverability status for current user
 */
export async function getUserConsentStatus(userUid: string) {
  const userRows = await db.select().from(users).where(eq(users.uid, userUid)).limit(1);
  const user = userRows[0];

  const userTrees = await db
    .select({
      treeId: tree.treeId,
      name: tree.name,
      isDiscoverable: tree.isDiscoverable,
      role: treeMember.role,
    })
    .from(treeMember)
    .innerJoin(tree, eq(treeMember.treeId, tree.treeId))
    .where(eq(treeMember.userUid, userUid));

  return {
    optedInDiscoverable: Boolean(user?.optedInDiscoverable),
    trees: userTrees.map((t) => ({
      treeId: t.treeId,
      name: t.name,
      isDiscoverable: Boolean(t.isDiscoverable),
      role: t.role,
    })),
  };
}
