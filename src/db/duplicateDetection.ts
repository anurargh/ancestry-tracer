import { db } from './index.ts';
import { person, matchCandidate, parentChild, partnership, tree, treeMember, users } from './schema.ts';
import { eq, and, or, sql, desc, inArray, isNull } from 'drizzle-orm';
import {
  MatchBand,
  MatchStatus,
  MatchScoreBreakdown,
  MatchCandidateRecord,
  PersonRecord,
} from '../types.ts';
import { getClaimsForPerson, getPersonById } from './people.ts';
import { evaluatePersonClaims } from '../utils/claims.ts';
import {
  soundex,
  stringSimilarity,
  parseFullName,
  extractBirthDecade,
} from '../utils/phonetics.ts';
import { recordAuditEntry } from './audit.ts';

/**
 * Checks whether a person record is discoverable for a specific user.
 * Enforces Zero Information Leakage:
 * - Living persons (is_living = true) default to family_only and are NEVER surfaced in discovery
 *   unless BOTH the searching user AND the living person's tree owner have opted in to being discoverable.
 * - If either side has not consented, returns false immediately.
 */
export async function checkPersonDiscoverableForUser(
  personRecord: PersonRecord,
  requestingUid: string
): Promise<boolean> {
  // If requesting user is the creator of this person record
  if (personRecord.createdBy === requestingUid) return true;

  // If person belongs to a tree, check if requesting user is a member of that tree
  if (personRecord.treeId) {
    const membership = await db
      .select()
      .from(treeMember)
      .where(
        and(
          eq(treeMember.treeId, personRecord.treeId),
          eq(treeMember.userUid, requestingUid)
        )
      )
      .limit(1);

    if (membership.length > 0) return true;
  }

  // If deceased and public
  if (!personRecord.isLiving && personRecord.privacyLevel === 'public') {
    return true;
  }

  // If person is LIVING:
  // Both searching user and living person's tree owner must have opted in!
  if (personRecord.isLiving) {
    // 1. Check searching user consent flag
    const searchingUserRows = await db
      .select({ optedIn: users.optedInDiscoverable })
      .from(users)
      .where(eq(users.uid, requestingUid))
      .limit(1);

    const searchingUserOptedIn = Boolean(searchingUserRows[0]?.optedIn);
    if (!searchingUserOptedIn) {
      // Searching user has not consented to discovery -> zero leakage, silently omit
      return false;
    }

    // 2. Check living person's tree owner consent flag
    let ownerUid = personRecord.createdBy;
    let treeIsDiscoverable = false;

    if (personRecord.treeId) {
      const treeRows = await db
        .select({ ownerUid: tree.ownerUid, isDiscoverable: tree.isDiscoverable })
        .from(tree)
        .where(eq(tree.treeId, personRecord.treeId))
        .limit(1);

      if (treeRows[0]) {
        ownerUid = treeRows[0].ownerUid;
        treeIsDiscoverable = Boolean(treeRows[0].isDiscoverable);
      }
    }

    if (!ownerUid) return false;

    const ownerUserRows = await db
      .select({ optedIn: users.optedInDiscoverable })
      .from(users)
      .where(eq(users.uid, ownerUid))
      .limit(1);

    const ownerOptedIn = Boolean(ownerUserRows[0]?.optedIn) || treeIsDiscoverable;
    if (!ownerOptedIn) {
      // Living person's tree owner has not consented -> zero leakage, silently omit
      return false;
    }

    return true;
  }

  // Deceased but family_only/private and user is not a tree member
  return false;
}

interface PersonProfileSummary {
  personId: string;
  isLiving: boolean;
  mergedInto: string | null;
  name: string;
  givenName: string;
  surname: string;
  surnameSoundex: string;
  birthDate: string;
  birthYear: number | null;
  birthDecade: number | null;
  birthDecadeKey: string;
  birthPlace: string;
  parentPersonIds: Set<string>;
  spousePersonIds: Set<string>;
  claims: any[];
}

/**
 * Builds a fast in-memory profile summary for candidate blocking and scoring
 */
async function buildPersonProfile(personId: string): Promise<PersonProfileSummary | null> {
  const pRows = await db.select().from(person).where(eq(person.personId, personId)).limit(1);
  if (!pRows[0]) return null;

  const claims = await getClaimsForPerson(personId);
  const evaluation = evaluatePersonClaims(claims);

  const nameVal = evaluation['name']?.bestClaims[0]?.value || '';
  const birthVal = evaluation['birth_date']?.bestClaims[0]?.value || '';
  const placeVal = evaluation['birth_place']?.bestClaims[0]?.value || '';

  const { given, surname } = parseFullName(nameVal);
  const surnameSoundex = soundex(surname);
  const { year: birthYear, decade: birthDecade, decadeKey: birthDecadeKey } = extractBirthDecade(birthVal);

  // Fetch linked parents from parentChild
  const parentLinks = await db
    .select({ parentId: parentChild.parentId })
    .from(parentChild)
    .where(eq(parentChild.childId, personId));

  const parentPersonIds = new Set<string>(parentLinks.map((p) => p.parentId));

  // Fetch linked partners/spouses from partnership
  const partnerLinks = await db
    .select({ p1: partnership.person1Id, p2: partnership.person2Id })
    .from(partnership)
    .where(or(eq(partnership.person1Id, personId), eq(partnership.person2Id, personId)));

  const spousePersonIds = new Set<string>();
  for (const part of partnerLinks) {
    if (part.p1 === personId) spousePersonIds.add(part.p2);
    else spousePersonIds.add(part.p1);
  }

  return {
    personId,
    isLiving: pRows[0].isLiving,
    mergedInto: pRows[0].mergedInto,
    name: nameVal,
    givenName: given,
    surname,
    surnameSoundex,
    birthDate: birthVal,
    birthYear,
    birthDecade,
    birthDecadeKey,
    birthPlace: placeVal,
    parentPersonIds,
    spousePersonIds,
    claims,
  };
}

/**
 * Heuristically scores a pair of person records for potential duplicate match
 *
 * Scoring breakdown:
 * 1. Fuzzy Name Similarity (up to 30 pts)
 * 2. Birth-Date Proximity (up to 25 pts)
 * 3. Birthplace Match (up to 15 pts)
 * 4. Linked Family Resolution (Parents & Spouse) (Weighted highest: up to 40 pts)
 *
 * Total Score = Name + Birth + Place + Family (max ~110, normalized to 100)
 * Bands:
 *   - 'strong' (score >= 75)
 *   - 'possible' (40 <= score < 75)
 *   - 'unlikely' (score < 40)
 */
export function scoreCandidatePair(
  pA: PersonProfileSummary,
  pB: PersonProfileSummary
): MatchScoreBreakdown {
  const blockingKey = `${pA.surnameSoundex}_${pA.birthDecadeKey}`;

  // ==========================================
  // 1. Fuzzy Name Similarity (up to 30 points)
  // ==========================================
  let nameSimilarity = 0;
  let nameNotes = '';

  if (pA.name && pB.name) {
    const fullNameSim = stringSimilarity(pA.name, pB.name);
    const surnameSim = stringSimilarity(pA.surname, pB.surname);
    const givenSim = stringSimilarity(pA.givenName, pB.givenName);
    const sameSoundex = pA.surnameSoundex === pB.surnameSoundex;

    if (fullNameSim > 0.95) {
      nameSimilarity = 30;
      nameNotes = `Exact/near-exact full name match ("${pA.name}" vs "${pB.name}")`;
    } else if (surnameSim > 0.85 && givenSim > 0.75) {
      nameSimilarity = 26;
      nameNotes = `High surname (${(surnameSim * 100).toFixed(0)}%) and given name (${(givenSim * 100).toFixed(0)}%) match`;
    } else if (sameSoundex && givenSim > 0.7) {
      nameSimilarity = 22;
      nameNotes = `Phonetic Soundex surname match (${pA.surnameSoundex}) and strong given name match`;
    } else if (sameSoundex && (pA.givenName.includes(pB.givenName) || pB.givenName.includes(pA.givenName))) {
      nameSimilarity = 18;
      nameNotes = `Phonetic Soundex surname match with partial/initial given name overlap`;
    } else if (sameSoundex) {
      nameSimilarity = 12;
      nameNotes = `Phonetic surname match (${pA.surnameSoundex}), given names differ ("${pA.givenName}" vs "${pB.givenName}")`;
    } else if (fullNameSim > 0.6) {
      nameSimilarity = Math.round(fullNameSim * 20);
      nameNotes = `Moderate string similarity (${(fullNameSim * 100).toFixed(0)}%)`;
    } else {
      nameSimilarity = 4;
      nameNotes = `Low name similarity ("${pA.name}" vs "${pB.name}")`;
    }
  } else {
    nameSimilarity = 5;
    nameNotes = 'Incomplete name claims on one or both records';
  }

  // ==========================================
  // 2. Birth-Date Proximity (up to 25 points)
  // ==========================================
  let birthProximity = 0;
  let birthNotes = '';

  if (pA.birthYear !== null && pB.birthYear !== null) {
    const diff = Math.abs(pA.birthYear - pB.birthYear);
    if (diff === 0) {
      if (pA.birthDate.trim() && pA.birthDate.trim() === pB.birthDate.trim()) {
        birthProximity = 25;
        birthNotes = `Identical exact birth date ("${pA.birthDate}")`;
      } else {
        birthProximity = 22;
        birthNotes = `Exact same birth year (${pA.birthYear})`;
      }
    } else if (diff === 1) {
      birthProximity = 18;
      birthNotes = `Birth year within 1 year (${pA.birthYear} vs ${pB.birthYear})`;
    } else if (diff <= 3) {
      birthProximity = 12;
      birthNotes = `Birth year within ${diff} years (${pA.birthYear} vs ${pB.birthYear})`;
    } else if (diff <= 8) {
      birthProximity = 6;
      birthNotes = `Same or adjacent decade (diff = ${diff} years)`;
    } else {
      birthProximity = 0;
      birthNotes = `Substantial birth year conflict (${pA.birthYear} vs ${pB.birthYear}, ${diff} years difference)`;
    }
  } else if (pA.birthDate || pB.birthDate) {
    birthProximity = 8;
    birthNotes = 'Partial or unparsed birth date on one record';
  } else {
    birthProximity = 6;
    birthNotes = 'Birth date omitted on both records (neutral)';
  }

  // ==========================================
  // 3. Birthplace Match (up to 15 points)
  // ==========================================
  let birthplaceMatch = 0;
  let birthplaceNotes = '';

  if (pA.birthPlace && pB.birthPlace) {
    const placeSim = stringSimilarity(pA.birthPlace, pB.birthPlace);
    const normA = pA.birthPlace.toLowerCase();
    const normB = pB.birthPlace.toLowerCase();

    if (placeSim > 0.85 || normA === normB) {
      birthplaceMatch = 15;
      birthplaceNotes = `Exact or normalized birthplace match ("${pA.birthPlace}")`;
    } else if (normA.includes(normB) || normB.includes(normA)) {
      birthplaceMatch = 12;
      birthplaceNotes = `Substring birthplace overlap ("${pA.birthPlace}" vs "${pB.birthPlace}")`;
    } else {
      // Check shared tokens (e.g. city, state, country)
      const tokensA = normA.split(/[\s,.-]+/).filter((t) => t.length > 2);
      const tokensB = normB.split(/[\s,.-]+/).filter((t) => t.length > 2);
      const sharedTokens = tokensA.filter((t) => tokensB.includes(t));

      if (sharedTokens.length > 0) {
        birthplaceMatch = 8;
        birthplaceNotes = `Shared jurisdiction/place tokens (${sharedTokens.join(', ')})`;
      } else {
        birthplaceMatch = 1;
        birthplaceNotes = `Conflicting birthplaces ("${pA.birthPlace}" vs "${pB.birthPlace}")`;
      }
    }
  } else if (!pA.birthPlace && !pB.birthPlace) {
    birthplaceMatch = 5;
    birthplaceNotes = 'Birthplace unspecified on both records (neutral)';
  } else {
    birthplaceMatch = 6;
    birthplaceNotes = 'Birthplace specified on only one record (compatible)';
  }

  // =========================================================================
  // 4. Linked Family Resolution (Parents & Spouse) (Weighted highest: up to 40 pts)
  // =========================================================================
  let familyResolution = 0;
  let familyNotes = '';

  // Check parent overlap
  const sharedParents: string[] = [];
  for (const pId of pA.parentPersonIds) {
    if (pB.parentPersonIds.has(pId)) {
      sharedParents.push(pId);
    }
  }

  // Check spouse overlap
  const sharedSpouses: string[] = [];
  for (const sId of pA.spousePersonIds) {
    if (pB.spousePersonIds.has(sId)) {
      sharedSpouses.push(sId);
    }
  }

  if (sharedParents.length >= 2) {
    familyResolution += 40;
    familyNotes = `Both claimed parents resolve to the SAME 2 linked individuals in database!`;
  } else if (sharedParents.length === 1) {
    familyResolution += 25;
    familyNotes = `Shares 1 linked parent entity in common`;
  }

  if (sharedSpouses.length >= 1) {
    familyResolution += Math.min(35, 25 * sharedSpouses.length);
    familyNotes += (familyNotes ? ' + ' : '') + `Shares ${sharedSpouses.length} linked spouse/partner entity in common`;
  }

  // Cap family resolution at 40
  familyResolution = Math.min(40, familyResolution);

  if (familyResolution === 0) {
    if (pA.parentPersonIds.size > 0 && pB.parentPersonIds.size > 0) {
      familyNotes = 'Different linked parents recorded (no shared parent edges)';
    } else if (pA.parentPersonIds.size === 0 && pB.parentPersonIds.size === 0) {
      familyNotes = 'No linked parent entities recorded for comparison';
      familyResolution = 5; // Neutral baseline
    } else {
      familyNotes = 'Parent links partially recorded';
      familyResolution = 4;
    }
  }

  // Calculate total score (0 to 100)
  const rawScore = nameSimilarity + birthProximity + birthplaceMatch + familyResolution;
  const totalScore = Math.min(100, Math.max(0, rawScore));

  // Determine heuristic band
  let band: MatchBand = 'unlikely';
  if (totalScore >= 75 || (familyResolution >= 35 && nameSimilarity >= 18)) {
    band = 'strong';
  } else if (totalScore >= 40) {
    band = 'possible';
  } else {
    band = 'unlikely';
  }

  return {
    nameSimilarity,
    nameNotes,
    birthProximity,
    birthNotes,
    birthplaceMatch,
    birthplaceNotes,
    familyResolution,
    familyNotes,
    totalScore,
    band,
    blockingKey,
  };
}

/**
 * Evaluates duplicate match candidates for a single person against all others in DB
 */
export async function generateMatchCandidatesForPerson(personId: string): Promise<number> {
  const targetProfile = await buildPersonProfile(personId);
  if (!targetProfile) return 0;

  // Fetch all other persons
  const otherPersons = await db
    .select({ personId: person.personId })
    .from(person)
    .where(and(isNull(person.mergedInto), sql`${person.personId} != ${personId}`));

  let candidateCount = 0;

  for (const other of otherPersons) {
    const otherProfile = await buildPersonProfile(other.personId);
    if (!otherProfile) continue;

    // Standardized pair order: personAId < personBId
    const [pAId, pBId] = personId < other.personId ? [personId, other.personId] : [other.personId, personId];
    const [pAProfile, pBProfile] = personId < other.personId ? [targetProfile, otherProfile] : [otherProfile, targetProfile];

    // Blocking rule: Soundex(surname) + birth decade
    // We allow match if soundex matches OR birth decade matches (or unknown decade)
    const soundexMatch = pAProfile.surnameSoundex === pBProfile.surnameSoundex;
    const decadeMatch =
      pAProfile.birthDecade === null ||
      pBProfile.birthDecade === null ||
      Math.abs((pAProfile.birthDecade || 0) - (pBProfile.birthDecade || 0)) <= 10;

    // Only score if blocking criteria is satisfied (same soundex OR exact full name)
    const nameMatch = stringSimilarity(pAProfile.name, pBProfile.name) > 0.6;

    if (soundexMatch || nameMatch) {
      const breakdown = scoreCandidatePair(pAProfile, pBProfile);

      // Check if existing candidate row exists
      const existing = await db
        .select()
        .from(matchCandidate)
        .where(and(eq(matchCandidate.personAId, pAId), eq(matchCandidate.personBId, pBId)))
        .limit(1);

      if (existing[0]) {
        // If pending, update score & band
        if (existing[0].status === 'pending') {
          await db
            .update(matchCandidate)
            .set({
              score: breakdown.totalScore,
              band: breakdown.band,
              breakdown: JSON.stringify(breakdown),
            })
            .where(and(eq(matchCandidate.personAId, pAId), eq(matchCandidate.personBId, pBId)));
        }
      } else {
        await db.insert(matchCandidate).values({
          personAId: pAId,
          personBId: pBId,
          score: breakdown.totalScore,
          band: breakdown.band,
          status: 'pending',
          breakdown: JSON.stringify(breakdown),
        });
        candidateCount++;
      }
    }
  }

  return candidateCount;
}

/**
 * Scan all persons across the database to detect duplicate match candidates
 */
export async function scanAllDuplicateCandidates(): Promise<{ scanned: number; generated: number }> {
  const allPersons = await db
    .select({ personId: person.personId })
    .from(person)
    .where(isNull(person.mergedInto));

  const profiles: PersonProfileSummary[] = [];
  for (const p of allPersons) {
    const prof = await buildPersonProfile(p.personId);
    if (prof) profiles.push(prof);
  }

  let generated = 0;

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const pA = profiles[i].personId < profiles[j].personId ? profiles[i] : profiles[j];
      const pB = profiles[i].personId < profiles[j].personId ? profiles[j] : profiles[i];

      const soundexMatch = pA.surnameSoundex === pB.surnameSoundex;
      const nameMatch = stringSimilarity(pA.name, pB.name) > 0.6;

      if (soundexMatch || nameMatch) {
        const breakdown = scoreCandidatePair(pA, pB);

        // Upsert candidate
        const existing = await db
          .select()
          .from(matchCandidate)
          .where(and(eq(matchCandidate.personAId, pA.personId), eq(matchCandidate.personBId, pB.personId)))
          .limit(1);

        if (existing[0]) {
          if (existing[0].status === 'pending') {
            await db
              .update(matchCandidate)
              .set({
                score: breakdown.totalScore,
                band: breakdown.band,
                breakdown: JSON.stringify(breakdown),
              })
              .where(and(eq(matchCandidate.personAId, pA.personId), eq(matchCandidate.personBId, pB.personId)));
          }
        } else {
          await db.insert(matchCandidate).values({
            personAId: pA.personId,
            personBId: pB.personId,
            score: breakdown.totalScore,
            band: breakdown.band,
            status: 'pending',
            breakdown: JSON.stringify(breakdown),
          });
          generated++;
        }
      }
    }
  }

  return { scanned: profiles.length, generated };
}

/**
 * Fetch match candidates with optional band, status, and zero-information-leak privacy filters
 */
export async function getMatchCandidates(filters?: {
  band?: MatchBand;
  status?: MatchStatus;
  requestingUid?: string;
}): Promise<MatchCandidateRecord[]> {
  let query = db.select().from(matchCandidate);

  const conditions = [];
  if (filters?.band) {
    conditions.push(eq(matchCandidate.band, filters.band));
  }
  if (filters?.status) {
    conditions.push(eq(matchCandidate.status, filters.status));
  }

  const rows = conditions.length > 0
    ? await db.select().from(matchCandidate).where(and(...conditions)).orderBy(desc(matchCandidate.score))
    : await db.select().from(matchCandidate).orderBy(desc(matchCandidate.score));

  const result: MatchCandidateRecord[] = [];

  for (const row of rows) {
    const [pA, pB] = await Promise.all([
      getPersonById(row.personAId),
      getPersonById(row.personBId),
    ]);

    if (!pA || !pB) continue;

    // Privacy & Zero Information Leak enforcement:
    // If requestingUid is provided, verify both persons can be surfaced to the user.
    // If either person is living and either party has not consented, SILENTLY omit the match candidate.
    if (filters?.requestingUid) {
      const [discA, discB] = await Promise.all([
        checkPersonDiscoverableForUser(pA, filters.requestingUid),
        checkPersonDiscoverableForUser(pB, filters.requestingUid),
      ]);

      if (!discA || !discB) {
        // Zero information leak: Drop candidate completely with no placeholder or leak
        continue;
      }
    }

    const evalA = evaluatePersonClaims(pA.claims || []);
    const evalB = evaluatePersonClaims(pB.claims || []);

    const nameA = evalA['name']?.bestClaims[0]?.value || `Person (${pA.personId.slice(0, 8)})`;
    const nameB = evalB['name']?.bestClaims[0]?.value || `Person (${pB.personId.slice(0, 8)})`;

    let breakdownObj: MatchScoreBreakdown | null = null;
    if (row.breakdown) {
      try {
        breakdownObj = JSON.parse(row.breakdown);
      } catch (e) {
        breakdownObj = null;
      }
    }

    result.push({
      personAId: row.personAId,
      personBId: row.personBId,
      score: row.score,
      band: row.band as MatchBand,
      status: row.status as MatchStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      breakdown: breakdownObj,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      personA: {
        ...pA,
        displayName: nameA,
        birthDate: evalA['birth_date']?.bestClaims[0]?.value,
        birthPlace: evalA['birth_place']?.bestClaims[0]?.value,
      },
      personB: {
        ...pB,
        displayName: nameB,
        birthDate: evalB['birth_date']?.bestClaims[0]?.value,
        birthPlace: evalB['birth_place']?.bestClaims[0]?.value,
      },
    });
  }

  return result;
}

/**
 * Approve a duplicate match candidate:
 * - Does NOT delete either record.
 * - Sets `merged_into` on the duplicate person to point at the canonical person.
 * - Updates match_candidate status to 'approved', reviewed_by, reviewed_at.
 */
export async function approveDuplicateMatch(
  personAId: string,
  personBId: string,
  canonicalPersonId: string,
  reviewedBy: string
): Promise<{ success: boolean; canonicalId: string; duplicateId: string }> {
  // Identify which person is duplicate
  const duplicatePersonId = canonicalPersonId === personAId ? personBId : personAId;

  // 1. Update duplicate person record to set merged_into = canonicalPersonId
  await db
    .update(person)
    .set({
      mergedInto: canonicalPersonId,
    })
    .where(eq(person.personId, duplicatePersonId));

  // 2. Update match candidate status to approved
  const [pAId, pBId] = personAId < personBId ? [personAId, personBId] : [personBId, personAId];

  await db
    .update(matchCandidate)
    .set({
      status: 'approved',
      reviewedBy,
      reviewedAt: new Date(),
    })
    .where(
      or(
        and(eq(matchCandidate.personAId, pAId), eq(matchCandidate.personBId, pBId)),
        and(eq(matchCandidate.personAId, pBId), eq(matchCandidate.personBId, pAId)),
        and(eq(matchCandidate.personAId, personAId), eq(matchCandidate.personBId, personBId)),
        and(eq(matchCandidate.personAId, personBId), eq(matchCandidate.personBId, personAId))
      )
    );

  // 3. Record Audit Log for duplicate merge
  await recordAuditEntry({
    entityType: 'match_candidate',
    entityId: `${pAId}:${pBId}`,
    action: 'merge',
    oldValue: {
      canonicalId: canonicalPersonId,
      duplicateId: duplicatePersonId,
      status: 'pending',
    },
    newValue: {
      canonicalId: canonicalPersonId,
      duplicateId: duplicatePersonId,
      status: 'approved',
      reviewedBy,
    },
    changedBy: reviewedBy,
  });

  return {
    success: true,
    canonicalId: canonicalPersonId,
    duplicateId: duplicatePersonId,
  };
}

/**
 * Reject a duplicate match candidate:
 * - Keeps both records active.
 * - Sets status = 'rejected', reviewed_by, reviewed_at.
 */
export async function rejectDuplicateMatch(
  personAId: string,
  personBId: string,
  reviewedBy: string
): Promise<{ success: boolean }> {
  const [pAId, pBId] = personAId < personBId ? [personAId, personBId] : [personBId, personAId];

  await db
    .update(matchCandidate)
    .set({
      status: 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
    })
    .where(
      or(
        and(eq(matchCandidate.personAId, pAId), eq(matchCandidate.personBId, pBId)),
        and(eq(matchCandidate.personAId, pBId), eq(matchCandidate.personBId, pAId)),
        and(eq(matchCandidate.personAId, personAId), eq(matchCandidate.personBId, personBId)),
        and(eq(matchCandidate.personAId, personBId), eq(matchCandidate.personBId, personAId))
      )
    );

  await recordAuditEntry({
    entityType: 'match_candidate',
    entityId: `${pAId}:${pBId}`,
    action: 'update',
    oldValue: { status: 'pending' },
    newValue: { status: 'rejected', reviewedBy },
    changedBy: reviewedBy,
  });

  return { success: true };
}

/**
 * Revert a match decision back to pending
 */
export async function revertDuplicateMatch(
  personAId: string,
  personBId: string
): Promise<{ success: boolean }> {
  const [pAId, pBId] = personAId < personBId ? [personAId, personBId] : [personBId, personAId];

  // If one was merged into the other, unmerge it
  await db
    .update(person)
    .set({ mergedInto: null })
    .where(
      and(
        or(eq(person.personId, personAId), eq(person.personId, personBId)),
        or(eq(person.mergedInto, personAId), eq(person.mergedInto, personBId))
      )
    );

  await db
    .update(matchCandidate)
    .set({
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    })
    .where(
      or(
        and(eq(matchCandidate.personAId, pAId), eq(matchCandidate.personBId, pBId)),
        and(eq(matchCandidate.personAId, pBId), eq(matchCandidate.personBId, pAId)),
        and(eq(matchCandidate.personAId, personAId), eq(matchCandidate.personBId, personBId)),
        and(eq(matchCandidate.personAId, personBId), eq(matchCandidate.personBId, personAId))
      )
    );

  await recordAuditEntry({
    entityType: 'match_candidate',
    entityId: `${pAId}:${pBId}`,
    action: 'update',
    oldValue: { status: 'resolved' },
    newValue: { status: 'pending' },
    changedBy: 'user',
  });

  return { success: true };
}
