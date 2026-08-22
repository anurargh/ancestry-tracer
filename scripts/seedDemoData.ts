import { db } from '../src/db/index.ts';
import {
  users,
  tree,
  treeMember,
  person,
  personClaim,
  source,
  parentChild,
  partnership,
  ancestorClosure,
  matchCandidate,
  personMedia,
  auditLog,
} from '../src/db/schema.ts';
import { getOrCreateUser } from '../src/db/users.ts';
import { createTree, setTreeMemberRole } from '../src/db/trees.ts';
import { createPersonWithClaims, addClaimToPerson } from '../src/db/people.ts';
import { addParentChildRelationship, addPartnership, rebuildAllAncestorClosures } from '../src/db/relationships.ts';
import { addPersonMedia } from '../src/db/media.ts';
import { scanAllDuplicateCandidates } from '../src/db/duplicateDetection.ts';
import { sql, eq } from 'drizzle-orm';

async function seedCuratedDemoData() {
  console.log('--- Starting Curated Demo Dataset Population ---');

  // 1. Clean existing database tables cleanly
  console.log('Cleaning existing tables...');
  await db.delete(matchCandidate);
  await db.delete(personMedia);
  await db.delete(ancestorClosure);
  await db.delete(partnership);
  await db.delete(parentChild);
  await db.delete(personClaim);
  await db.delete(source);
  await db.delete(auditLog);
  await db.delete(treeMember);
  await db.delete(person);
  await db.delete(tree);
  await db.delete(users);
  console.log('All tables cleared successfully.');

  // 2. Create Users
  console.log('Creating demo users...');
  const userAlice = await getOrCreateUser(
    'user-alice-pemberton',
    'alice.pemberton@example.com',
    'Alice Pemberton',
    null
  );
  await db.update(users).set({ optedInDiscoverable: true }).where(eq(users.uid, 'user-alice-pemberton'));

  const userDavid = await getOrCreateUser(
    'user-david-montgomery',
    'david.montgomery@example.com',
    'David Montgomery',
    null
  );
  await db.update(users).set({ optedInDiscoverable: true }).where(eq(users.uid, 'user-david-montgomery'));

  // Current session user account to have immediate access
  const userAnurag = await getOrCreateUser(
    'anuragsinghsisodiya21',
    'anuragsinghsisodiya21@gmail.com',
    'Anurag Sisodiya',
    null
  );
  await db.update(users).set({ optedInDiscoverable: true }).where(eq(users.uid, 'anuragsinghsisodiya21'));

  // 3. Create Trees
  console.log('Creating demo family trees...');
  const tree1 = await createTree(
    'Pemberton Heritage Tree',
    'Primary genealogical lineage of the Pemberton-Hastings family from Boston and Cambridge, MA.',
    'user-alice-pemberton',
    true // discoverable
  );
  // Grant editor / owner membership to current user on Tree 1
  await setTreeMemberRole(tree1.treeId, 'user-alice-pemberton', 'anuragsinghsisodiya21', 'anuragsinghsisodiya21@gmail.com', 'owner');

  const tree2 = await createTree(
    'Montgomery Family Tree',
    'Montgomery & Whitmore branch founded in Hartford and New Haven, CT.',
    'user-david-montgomery',
    true // discoverable
  );
  await setTreeMemberRole(tree2.treeId, 'user-david-montgomery', 'anuragsinghsisodiya21', 'anuragsinghsisodiya21@gmail.com', 'editor');

  const tree3 = await createTree(
    'Research & Unlinked Records',
    'Unassigned external archival records and prospective candidates.',
    'user-alice-pemberton',
    false
  );
  await setTreeMemberRole(tree3.treeId, 'user-alice-pemberton', 'anuragsinghsisodiya21', 'anuragsinghsisodiya21@gmail.com', 'editor');

  console.log('Trees created:', { tree1: tree1.treeId, tree2: tree2.treeId, tree3: tree3.treeId });

  // Map to hold created person objects
  const P: Record<string, any> = {};

  // ==========================================
  // TREE 1: PEMBERTON HERITAGE TREE
  // ==========================================
  console.log('Inserting Tree 1: Generation 1 (Great-Grandparents)...');

  // 1. Arthur Pemberton (Shared Patriarch)
  P.arthur = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Arthur Pemberton',
        sourceType: 'certificate',
        citation: 'Commonwealth of Massachusetts Death Register Vol 1972/419',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1895-04-12',
        sourceType: 'certificate',
        citation: 'Boston City Birth Registry 1895, Page 112, Record #441',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Boston City Birth Registry 1895, Page 112',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1972-11-03',
        sourceType: 'certificate',
        citation: 'Massachusetts Vital Statistics Death Certificate #72-10892',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 2. Eleanor Vance Pemberton (Arthur's 1st wife)
  P.eleanor = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Eleanor Vance Pemberton',
        sourceType: 'certificate',
        citation: 'Rhode Island Vital Records Birth Book 1898 #881',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1898-09-20',
        sourceType: 'certificate',
        citation: 'Providence City Hall Birth Records 1898',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Providence, Providence County, RI',
        sourceType: 'certificate',
        citation: 'Providence City Hall Birth Records 1898',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1965-02-14',
        sourceType: 'certificate',
        citation: 'Boston Vital Records Death Index 1965',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 3. George Hastings (Shared Grandparent for Cousin Marriage)
  P.george = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'George Hastings',
        sourceType: 'census',
        citation: '1900 US Federal Census Middlesex County MA E.D. 41',
        reliabilityTier: 3,
        confidence: 90,
      },
      {
        attributeType: 'birth_date',
        value: '1890-01-15',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Registry 1890',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Cambridge, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Registry 1890',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1968-07-22',
        sourceType: 'certificate',
        citation: 'Middlesex County Probate Docket #68-4421',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 4. Margaret Hastings
  P.margaret = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Margaret Hastings',
        sourceType: 'census',
        citation: '1910 US Federal Census Middlesex County MA',
        reliabilityTier: 3,
        confidence: 90,
      },
      {
        attributeType: 'birth_date',
        value: '1894-06-30',
        sourceType: 'certificate',
        citation: 'Concord Town Clerk Birth Register 1894',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Concord, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Concord Town Clerk Birth Register 1894',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1974-10-18',
        sourceType: 'certificate',
        citation: 'Massachusetts Death Certificate #74-99120',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  console.log('Inserting Tree 1: Generation 2 (Grandparents & Siblings)...');

  // 5. William Pemberton (Son of Arthur & Eleanor)
  P.william = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'William Pemberton',
        sourceType: 'certificate',
        citation: 'Boston City Birth Register 1920 #20-1194',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1920-03-10',
        sourceType: 'certificate',
        citation: 'Boston City Birth Register 1920 #20-1194',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Boston City Birth Register 1920 #20-1194',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1998-05-12',
        sourceType: 'certificate',
        citation: 'Massachusetts Death Index 1998',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 6. Rose Hastings Pemberton (Daughter of George & Margaret)
  P.rose = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Rose Hastings Pemberton',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1923',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1923-08-14',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1923',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Cambridge, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1923',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2005-01-20',
        sourceType: 'certificate',
        citation: 'Massachusetts Death Certificate #05-00129',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 7. Thomas Hastings (Son of George & Margaret - Rose's Brother)
  P.thomas = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Thomas Hastings',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1926',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1926-11-05',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1926',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Cambridge, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1926',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2010-04-18',
        sourceType: 'certificate',
        citation: 'Middlesex County Death Certificate 2010',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 8. Dorothy Gale Hastings (Wife of Thomas Hastings)
  P.dorothy = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Dorothy Gale Hastings',
        sourceType: 'certificate',
        citation: 'Salem City Hall Birth Register 1928',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1928-02-19',
        sourceType: 'certificate',
        citation: 'Salem City Hall Birth Register 1928',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Salem, Essex County, MA',
        sourceType: 'certificate',
        citation: 'Salem City Hall Birth Register 1928',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2014-08-09',
        sourceType: 'certificate',
        citation: 'Massachusetts Vital Statistics 2014',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 9. Mary Lawson (Unknown Grandparent Branch)
  P.mary_lawson = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'unverified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Mary Lawson',
        sourceType: 'census',
        citation: '1940 US Federal Census Worcester County MA',
        reliabilityTier: 3,
        confidence: 85,
      },
      {
        attributeType: 'birth_date',
        value: '1935-12-01',
        sourceType: 'census',
        citation: '1940 US Federal Census Worcester County MA',
        reliabilityTier: 3,
        confidence: 85,
      },
      {
        attributeType: 'birth_place',
        value: 'Worcester, Worcester County, MA',
        sourceType: 'census',
        citation: '1940 US Federal Census Worcester County MA',
        reliabilityTier: 3,
        confidence: 85,
      },
      {
        attributeType: 'death_date',
        value: '2018-03-15',
        sourceType: 'certificate',
        citation: 'Worcester Vital Statistics 2018',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  console.log('Inserting Tree 1: Generation 3 (Parents & Cousin Marriage)...');

  // 10. Charles Pemberton (Son of William & Rose)
  P.charles = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Charles Pemberton',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Certificate #50-4819',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1950-06-18',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Certificate #50-4819',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Certificate #50-4819',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2020-09-11',
        sourceType: 'certificate',
        citation: 'Massachusetts Death Certificate #20-8812',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 11. Beatrice Hastings Pemberton (Daughter of Thomas & Dorothy - Charles's 1st Cousin)
  P.beatrice = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Beatrice Hastings Pemberton',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1952 #52-190',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1952-03-24',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1952 #52-190',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Cambridge, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Cambridge City Birth Register 1952 #52-190',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2019-12-05',
        sourceType: 'certificate',
        citation: 'Middlesex Vital Records 2019',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 12. Edward Pemberton (Charles's brother)
  P.edward = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Edward Pemberton',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Register 1953',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1953-10-04',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Register 1953',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Register 1953',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2015-08-22',
        sourceType: 'certificate',
        citation: 'Massachusetts Death Index 2015',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 13. Grace Miller Pemberton (Edward's Wife)
  P.grace = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Grace Miller Pemberton',
        sourceType: 'certificate',
        citation: 'Quincy Hospital Birth Register 1955',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1955-07-16',
        sourceType: 'certificate',
        citation: 'Quincy Hospital Birth Register 1955',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Quincy, Norfolk County, MA',
        sourceType: 'certificate',
        citation: 'Quincy Hospital Birth Register 1955',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 14. Evelyn Reed (Charles Pemberton's 2nd partner)
  P.evelyn = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Evelyn Reed',
        sourceType: 'certificate',
        citation: 'Newton-Wellesley Hospital Birth Register 1960',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1960-01-22',
        sourceType: 'certificate',
        citation: 'Newton-Wellesley Hospital Birth Register 1960',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Newton, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Newton-Wellesley Hospital Birth Register 1960',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 15. Julia Lawson (Daughter of Mary Lawson - unknown father)
  P.julia_lawson = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'unverified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Julia Lawson',
        sourceType: 'certificate',
        citation: 'Worcester City Hospital Birth Register 1960',
        reliabilityTier: 4,
        confidence: 90,
      },
      {
        attributeType: 'birth_date',
        value: '1960-04-14',
        sourceType: 'certificate',
        citation: 'Worcester City Hospital Birth Register 1960',
        reliabilityTier: 4,
        confidence: 90,
      },
      {
        attributeType: 'birth_place',
        value: 'Worcester, Worcester County, MA',
        sourceType: 'certificate',
        citation: 'Worcester City Hospital Birth Register 1960',
        reliabilityTier: 4,
        confidence: 90,
      },
    ],
  });

  // 16. Robert Thorne (Married Julia Lawson, step-father and adoptive father)
  P.robert_thorne = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Robert Thorne',
        sourceType: 'certificate',
        citation: 'New Hampshire Vital Records Birth Register 1948',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1948-11-30',
        sourceType: 'certificate',
        citation: 'Manchester City Hall Birth Records 1948',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Manchester, Hillsborough County, NH',
        sourceType: 'certificate',
        citation: 'Manchester City Hall Birth Records 1948',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2021-06-08',
        sourceType: 'certificate',
        citation: 'New Hampshire Certificate of Death 2021',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 17. Catherine Bell Thorne (Robert Thorne's first wife, biological mother of Marcus)
  P.catherine_bell = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Catherine Bell Thorne',
        sourceType: 'certificate',
        citation: 'Nashua City Vital Records 1950',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1950-02-10',
        sourceType: 'certificate',
        citation: 'Nashua City Vital Records 1950',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Nashua, Hillsborough County, NH',
        sourceType: 'certificate',
        citation: 'Nashua City Vital Records 1950',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1983-04-01',
        sourceType: 'certificate',
        citation: 'Hillsborough County Death Register 1983',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  console.log('Inserting Tree 1: Generation 4 (Children, Siblings, Cousins, Steps, Adoptions)...');

  // 18. Alexander Pemberton (Son of Charles & Beatrice)
  // Exercises THREE conflicting birth date claims and high-res media document!
  P.alexander = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Alexander Pemberton',
        sourceType: 'certificate',
        citation: 'Commonwealth of Massachusetts Department of Public Health Registry #78-09142',
        reliabilityTier: 4,
        confidence: 95,
      },
      // Claim 1 (BEST VALUE): Primary Certificate -> Tier 4, Confidence 95
      {
        attributeType: 'birth_date',
        value: '1978-05-14',
        sourceType: 'certificate',
        citation: 'Commonwealth of Massachusetts State Birth Certificate #78-09142',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Commonwealth of Massachusetts State Birth Certificate #78-09142',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // Add Conflicting Claim 2: Oral Testimony (Family Bible) -> Tier 2, Confidence 60
  await addClaimToPerson({
    personId: P.alexander.personId,
    attributeType: 'birth_date',
    value: '1978-05-18',
    sourceType: 'oral_testimony',
    citation: 'Family Bible handwritten entry recorded by grandmother Beatrice Hastings Pemberton',
    reliabilityTier: 2,
    confidence: 60,
    submittedBy: 'user-alice-pemberton',
  });

  // Add Conflicting Claim 3: User Assertion -> Tier 1, Confidence 35
  await addClaimToPerson({
    personId: P.alexander.personId,
    attributeType: 'birth_date',
    value: '1979-05-14',
    sourceType: 'user_assertion',
    citation: 'Anecdotal notation on high school graduation commencement program flyer',
    reliabilityTier: 1,
    confidence: 35,
    submittedBy: 'user-alice-pemberton',
  });

  // 19. Victoria Pemberton (Full sister of Alexander)
  P.victoria = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Victoria Pemberton',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Records 1982',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1982-09-08',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Records 1982',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Records 1982',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 20. Samuel Pemberton (Half-Brother of Alexander: same father Charles, mother Evelyn Reed)
  P.samuel = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Samuel Pemberton',
        sourceType: 'certificate',
        citation: 'Newton-Wellesley Hospital Birth Register 1988',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1988-11-23',
        sourceType: 'certificate',
        citation: 'Newton-Wellesley Hospital Birth Register 1988',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Newton, Middlesex County, MA',
        sourceType: 'certificate',
        citation: 'Newton-Wellesley Hospital Birth Register 1988',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 21. Julian Pemberton (Full 1st Cousin of Alexander: father Edward is brother of Charles)
  P.julian = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Julian Pemberton',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Register 1980',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1980-12-15',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Register 1980',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'certificate',
        citation: 'Boston City Hospital Birth Register 1980',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 22. Marcus Thorne (Biological son of Robert & Catherine Bell; STEP-SON of Julia Lawson)
  P.marcus = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Marcus Thorne',
        sourceType: 'certificate',
        citation: 'Manchester Hospital Birth Record 1975',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1975-08-19',
        sourceType: 'certificate',
        citation: 'Manchester Hospital Birth Record 1975',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Manchester, Hillsborough County, NH',
        sourceType: 'certificate',
        citation: 'Manchester Hospital Birth Record 1975',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 23. Oliver Thorne-Lawson (Biological son of Robert Thorne & Julia Lawson)
  P.oliver = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Oliver Thorne-Lawson',
        sourceType: 'certificate',
        citation: 'Concord Hospital Vital Records 1986',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1986-07-04',
        sourceType: 'certificate',
        citation: 'Concord Hospital Vital Records 1986',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Concord, Merrimack County, NH',
        sourceType: 'certificate',
        citation: 'Concord Hospital Vital Records 1986',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 24. Chloe Thorne (ADOPTED daughter of Robert Thorne & Julia Lawson)
  P.chloe = await createPersonWithClaims({
    treeId: tree1.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Chloe Thorne',
        sourceType: 'certificate',
        citation: 'Burlington Hospital Birth Certificate 1992 & Probate Adoption Order #92-A-104',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1992-04-10',
        sourceType: 'certificate',
        citation: 'Burlington Hospital Birth Certificate 1992',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Burlington, Chittenden County, VT',
        sourceType: 'certificate',
        citation: 'Burlington Hospital Birth Certificate 1992',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 25. Alex J. Pemberton (Near-Duplicate candidate for Alexander Pemberton in Tree 3)
  // Soundex: P516, Birth 1978-05-12 (2 days off), Same Birthplace -> Will trigger possible match!
  P.alex_dup = await createPersonWithClaims({
    treeId: tree3.treeId,
    isLiving: true,
    privacyLevel: 'public',
    ancestryStatus: 'unverified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Alex J Pemberton',
        sourceType: 'user_assertion',
        citation: 'Alumni Directory Suffolk County 1996 Edition',
        reliabilityTier: 2,
        confidence: 70,
      },
      {
        attributeType: 'birth_date',
        value: '1978-05-12',
        sourceType: 'user_assertion',
        citation: 'Alumni Directory Suffolk County 1996 Edition',
        reliabilityTier: 2,
        confidence: 70,
      },
      {
        attributeType: 'birth_place',
        value: 'Boston, Suffolk County, MA',
        sourceType: 'user_assertion',
        citation: 'Alumni Directory Suffolk County 1996 Edition',
        reliabilityTier: 2,
        confidence: 70,
      },
    ],
  });

  // ==========================================
  // TREE 2: MONTGOMERY FAMILY TREE (Built by David Montgomery)
  // Connects through shared patriarch Arthur Pemberton!
  // ==========================================
  console.log('Inserting Tree 2: Montgomery Family Lineage...');

  // 26. Clara Whitmore Pemberton (Arthur's 2nd marriage / partner in Tree 2)
  P.clara_whitmore = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Clara Whitmore Pemberton',
        sourceType: 'certificate',
        citation: 'Connecticut State Vital Records Birth Book 1902 #C-409',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1902-05-19',
        sourceType: 'certificate',
        citation: 'Hartford City Hall Birth Registry 1902',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Hartford, Hartford County, CT',
        sourceType: 'certificate',
        citation: 'Hartford City Hall Birth Registry 1902',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '1980-10-12',
        sourceType: 'certificate',
        citation: 'Connecticut Death Index 1980',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 27. Henry Pemberton (Son of Arthur Pemberton & Clara Whitmore)
  P.henry = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Henry Pemberton',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Records 1930 #30-811',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1930-08-25',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Records 1930 #30-811',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Hartford, Hartford County, CT',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Records 1930 #30-811',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2008-01-14',
        sourceType: 'certificate',
        citation: 'Connecticut Certificate of Death #08-00412',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 28. Sarah Jenkins Pemberton (Henry's Wife)
  P.sarah_jenkins = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: false,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Sarah Jenkins Pemberton',
        sourceType: 'certificate',
        citation: 'New Haven City Birth Register 1933',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1933-03-12',
        sourceType: 'certificate',
        citation: 'New Haven City Birth Register 1933',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'New Haven, New Haven County, CT',
        sourceType: 'certificate',
        citation: 'New Haven City Birth Register 1933',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'death_date',
        value: '2016-09-29',
        sourceType: 'certificate',
        citation: 'Connecticut Department of Health Death Index 2016',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 29. Lydia Pemberton Montgomery (Daughter of Henry & Sarah)
  P.lydia = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: true,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Lydia Pemberton Montgomery',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1958',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1958-07-21',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1958',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Hartford, Hartford County, CT',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1958',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 30. Richard Montgomery (Lydia's Husband)
  P.richard = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: true,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Richard Montgomery',
        sourceType: 'certificate',
        citation: 'Stamford Vital Records 1956',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1956-02-14',
        sourceType: 'certificate',
        citation: 'Stamford Vital Records 1956',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Stamford, Fairfield County, CT',
        sourceType: 'certificate',
        citation: 'Stamford Vital Records 1956',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 31. Lucas Montgomery (Son of Richard & Lydia - Opted IN to discovery)
  P.lucas = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: true,
    privacyLevel: 'public',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Lucas Montgomery',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1985 #85-1102',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1985-10-30',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1985',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Hartford, Hartford County, CT',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1985',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // 32. Hannah Montgomery (Living person who has NOT opted into discovery / consent gate target)
  // Living person + privacy_level: 'family_only' + unconsented -> Gate will SILENTLY hide her without leaks!
  P.hannah = await createPersonWithClaims({
    treeId: tree2.treeId,
    isLiving: true,
    privacyLevel: 'family_only',
    ancestryStatus: 'verified',
    createdBy: 'user-david-montgomery',
    claims: [
      {
        attributeType: 'name',
        value: 'Hannah Montgomery',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1990',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_date',
        value: '1990-03-18',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1990',
        reliabilityTier: 4,
        confidence: 95,
      },
      {
        attributeType: 'birth_place',
        value: 'Hartford, Hartford County, CT',
        sourceType: 'certificate',
        citation: 'Hartford Hospital Birth Register 1990',
        reliabilityTier: 4,
        confidence: 95,
      },
    ],
  });

  // ==========================================
  // UNLINKED / ISOLATED PERSON
  // ==========================================
  // 33. Dmitri Voronov (Isolated person with NO common ancestor to test "no known common ancestor")
  P.dmitri = await createPersonWithClaims({
    treeId: tree3.treeId,
    isLiving: true,
    privacyLevel: 'public',
    ancestryStatus: 'unverified',
    createdBy: 'user-alice-pemberton',
    claims: [
      {
        attributeType: 'name',
        value: 'Dmitri Voronov',
        sourceType: 'user_assertion',
        citation: 'Immigration naturalization manifest 2004',
        reliabilityTier: 2,
        confidence: 80,
      },
      {
        attributeType: 'birth_date',
        value: '1982-04-17',
        sourceType: 'user_assertion',
        citation: 'Immigration naturalization manifest 2004',
        reliabilityTier: 2,
        confidence: 80,
      },
      {
        attributeType: 'birth_place',
        value: 'St. Petersburg, Russia',
        sourceType: 'user_assertion',
        citation: 'Immigration naturalization manifest 2004',
        reliabilityTier: 2,
        confidence: 80,
      },
    ],
  });

  console.log('All 33 persons created successfully!');

  // ==========================================
  // RELATIONSHIPS & PARTNERSHIPS
  // Uses addPartnership & addParentChildRelationship so cycle checking,
  // incremental ancestor closures, and audit logs execute naturally!
  // ==========================================
  console.log('Adding Partnerships...');

  // Arthur & Eleanor
  await addPartnership({
    person1Id: P.arthur.personId,
    person2Id: P.eleanor.personId,
    unionType: 'marriage',
    startDate: '1918-06-12',
    endDate: '1965-02-14',
    sourceType: 'certificate',
    citation: 'Providence City Marriage Certificate #18-490',
    reliabilityTier: 4,
  });

  // George & Margaret Hastings
  await addPartnership({
    person1Id: P.george.personId,
    person2Id: P.margaret.personId,
    unionType: 'marriage',
    startDate: '1915-09-20',
    endDate: '1968-07-22',
    sourceType: 'certificate',
    citation: 'Cambridge City Marriage Register 1915',
    reliabilityTier: 4,
  });

  // William Pemberton & Rose Hastings
  await addPartnership({
    person1Id: P.william.personId,
    person2Id: P.rose.personId,
    unionType: 'marriage',
    startDate: '1945-04-14',
    endDate: '1998-05-12',
    sourceType: 'certificate',
    citation: 'Boston City Hall Marriage Certificate #45-1022',
    reliabilityTier: 4,
  });

  // Thomas Hastings & Dorothy Gale
  await addPartnership({
    person1Id: P.thomas.personId,
    person2Id: P.dorothy.personId,
    unionType: 'marriage',
    startDate: '1949-06-25',
    endDate: '2010-04-18',
    sourceType: 'certificate',
    citation: 'Salem City Marriage Records 1949',
    reliabilityTier: 4,
  });

  // COUSIN MARRIAGE (Pedigree Collapse): Charles Pemberton & Beatrice Hastings
  await addPartnership({
    person1Id: P.charles.personId,
    person2Id: P.beatrice.personId,
    unionType: 'marriage',
    startDate: '1974-08-10',
    endDate: '2019-12-05',
    sourceType: 'certificate',
    citation: 'Boston City Hall Marriage Registry Vol 1974 #74-8841',
    reliabilityTier: 4,
  });

  // Edward Pemberton & Grace Miller
  await addPartnership({
    person1Id: P.edward.personId,
    person2Id: P.grace.personId,
    unionType: 'marriage',
    startDate: '1978-05-20',
    endDate: '2015-08-22',
    sourceType: 'certificate',
    citation: 'Quincy Town Hall Marriage Register 1978',
    reliabilityTier: 4,
  });

  // Charles Pemberton & Evelyn Reed (2nd Union)
  await addPartnership({
    person1Id: P.charles.personId,
    person2Id: P.evelyn.personId,
    unionType: 'domestic_partnership',
    startDate: '1986-03-15',
    endDate: '2020-09-11',
    sourceType: 'user_assertion',
    citation: 'Family domestic registry record',
    reliabilityTier: 2,
  });

  // Robert Thorne & Catherine Bell (1st Marriage)
  await addPartnership({
    person1Id: P.robert_thorne.personId,
    person2Id: P.catherine_bell.personId,
    unionType: 'marriage',
    startDate: '1972-09-16',
    endDate: '1983-04-01',
    sourceType: 'certificate',
    citation: 'Manchester City Marriage Records 1972',
    reliabilityTier: 4,
  });

  // Robert Thorne & Julia Lawson (2nd Marriage)
  await addPartnership({
    person1Id: P.robert_thorne.personId,
    person2Id: P.julia_lawson.personId,
    unionType: 'marriage',
    startDate: '1985-06-22',
    endDate: '2021-06-08',
    sourceType: 'certificate',
    citation: 'Concord Marriage Certificate 1985 #85-301',
    reliabilityTier: 4,
  });

  // Arthur Pemberton & Clara Whitmore (Tree 2 Marriage)
  await addPartnership({
    person1Id: P.arthur.personId,
    person2Id: P.clara_whitmore.personId,
    unionType: 'marriage',
    startDate: '1928-10-18',
    endDate: '1972-11-03',
    sourceType: 'certificate',
    citation: 'Hartford City Hall Marriage Register 1928 #28-904',
    reliabilityTier: 4,
  });

  // Henry Pemberton & Sarah Jenkins
  await addPartnership({
    person1Id: P.henry.personId,
    person2Id: P.sarah_jenkins.personId,
    unionType: 'marriage',
    startDate: '1955-06-11',
    endDate: '2008-01-14',
    sourceType: 'certificate',
    citation: 'New Haven Marriage Register 1955',
    reliabilityTier: 4,
  });

  // Richard Montgomery & Lydia Pemberton
  await addPartnership({
    person1Id: P.richard.personId,
    person2Id: P.lydia.personId,
    unionType: 'marriage',
    startDate: '1981-05-16',
    sourceType: 'certificate',
    citation: 'Hartford Marriage Certificate 1981 #81-1209',
    reliabilityTier: 4,
  });

  console.log('Partnerships added.');

  // ==========================================
  // PARENT-CHILD RELATIONSHIPS
  // ==========================================
  console.log('Adding Parent-Child Edges with Ancestor Closures...');

  // William is child of Arthur & Eleanor (biological)
  await addParentChildRelationship({
    parentId: P.arthur.personId,
    childId: P.william.personId,
    relationshipType: 'biological',
    citation: 'Boston Birth Registry 1920 #20-1194',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.eleanor.personId,
    childId: P.william.personId,
    relationshipType: 'biological',
    citation: 'Boston Birth Registry 1920 #20-1194',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Rose & Thomas are children of George & Margaret Hastings (biological)
  await addParentChildRelationship({
    parentId: P.george.personId,
    childId: P.rose.personId,
    relationshipType: 'biological',
    citation: 'Cambridge Birth Register 1923',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.margaret.personId,
    childId: P.rose.personId,
    relationshipType: 'biological',
    citation: 'Cambridge Birth Register 1923',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.george.personId,
    childId: P.thomas.personId,
    relationshipType: 'biological',
    citation: 'Cambridge Birth Register 1926',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.margaret.personId,
    childId: P.thomas.personId,
    relationshipType: 'biological',
    citation: 'Cambridge Birth Register 1926',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Charles & Edward are children of William & Rose Pemberton (biological)
  await addParentChildRelationship({
    parentId: P.william.personId,
    childId: P.charles.personId,
    relationshipType: 'biological',
    citation: 'Boston City Hospital Birth Record #50-4819',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.rose.personId,
    childId: P.charles.personId,
    relationshipType: 'biological',
    citation: 'Boston City Hospital Birth Record #50-4819',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.william.personId,
    childId: P.edward.personId,
    relationshipType: 'biological',
    citation: 'Boston Birth Register 1953',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.rose.personId,
    childId: P.edward.personId,
    relationshipType: 'biological',
    citation: 'Boston Birth Register 1953',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Beatrice is child of Thomas & Dorothy Hastings (biological)
  await addParentChildRelationship({
    parentId: P.thomas.personId,
    childId: P.beatrice.personId,
    relationshipType: 'biological',
    citation: 'Cambridge Birth Register 1952 #52-190',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.dorothy.personId,
    childId: P.beatrice.personId,
    relationshipType: 'biological',
    citation: 'Cambridge Birth Register 1952 #52-190',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Julia Lawson is daughter of Mary Lawson (father unknown / omitted)
  await addParentChildRelationship({
    parentId: P.mary_lawson.personId,
    childId: P.julia_lawson.personId,
    relationshipType: 'biological',
    citation: 'Worcester Birth Certificate 1960',
    reliabilityTier: 4,
    confidence: 90,
  });

  // Alexander & Victoria are children of Charles & Beatrice (biological)
  // This combines Charles's line and Beatrice's line (Pedigree collapse through George & Margaret Hastings!)
  await addParentChildRelationship({
    parentId: P.charles.personId,
    childId: P.alexander.personId,
    relationshipType: 'biological',
    citation: 'Massachusetts State Birth Registry #78-09142',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.beatrice.personId,
    childId: P.alexander.personId,
    relationshipType: 'biological',
    citation: 'Massachusetts State Birth Registry #78-09142',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.charles.personId,
    childId: P.victoria.personId,
    relationshipType: 'biological',
    citation: 'Boston City Hospital Birth Records 1982',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.beatrice.personId,
    childId: P.victoria.personId,
    relationshipType: 'biological',
    citation: 'Boston City Hospital Birth Records 1982',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Samuel is child of Charles Pemberton & Evelyn Reed (HALF-SIBLING to Alexander & Victoria)
  await addParentChildRelationship({
    parentId: P.charles.personId,
    childId: P.samuel.personId,
    relationshipType: 'biological',
    citation: 'Newton-Wellesley Hospital Birth Register 1988',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.evelyn.personId,
    childId: P.samuel.personId,
    relationshipType: 'biological',
    citation: 'Newton-Wellesley Hospital Birth Register 1988',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Julian is child of Edward Pemberton & Grace Miller (FULL 1st COUSIN to Alexander & Victoria)
  await addParentChildRelationship({
    parentId: P.edward.personId,
    childId: P.julian.personId,
    relationshipType: 'biological',
    citation: 'Boston City Hospital Birth Register 1980',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.grace.personId,
    childId: P.julian.personId,
    relationshipType: 'biological',
    citation: 'Boston City Hospital Birth Register 1980',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Marcus Thorne is biological child of Robert Thorne & Catherine Bell
  await addParentChildRelationship({
    parentId: P.robert_thorne.personId,
    childId: P.marcus.personId,
    relationshipType: 'biological',
    citation: 'Manchester Hospital Birth Records 1975',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.catherine_bell.personId,
    childId: P.marcus.personId,
    relationshipType: 'biological',
    citation: 'Manchester Hospital Birth Records 1975',
    reliabilityTier: 4,
    confidence: 95,
  });

  // STEP-RELATIONSHIP: Julia Lawson is STEP-MOTHER to Marcus Thorne
  await addParentChildRelationship({
    parentId: P.julia_lawson.personId,
    childId: P.marcus.personId,
    relationshipType: 'step',
    citation: 'Marriage certificate of Robert Thorne & Julia Lawson 1985',
    reliabilityTier: 4,
    confidence: 90,
  });

  // Oliver Thorne-Lawson is biological child of Robert Thorne & Julia Lawson
  await addParentChildRelationship({
    parentId: P.robert_thorne.personId,
    childId: P.oliver.personId,
    relationshipType: 'biological',
    citation: 'Concord Hospital Vital Records 1986',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.julia_lawson.personId,
    childId: P.oliver.personId,
    relationshipType: 'biological',
    citation: 'Concord Hospital Vital Records 1986',
    reliabilityTier: 4,
    confidence: 95,
  });

  // ADOPTED RELATIONSHIP: Chloe Thorne is ADOPTED by Robert Thorne & Julia Lawson
  await addParentChildRelationship({
    parentId: P.robert_thorne.personId,
    childId: P.chloe.personId,
    relationshipType: 'adopted',
    citation: 'Chittenden County Probate Adoption Decree #92-A-104',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.julia_lawson.personId,
    childId: P.chloe.personId,
    relationshipType: 'adopted',
    citation: 'Chittenden County Probate Adoption Decree #92-A-104',
    reliabilityTier: 4,
    confidence: 95,
  });

  // TREE 2 RELATIONSHIPS:
  // Henry Pemberton is child of Arthur Pemberton & Clara Whitmore (biological)
  await addParentChildRelationship({
    parentId: P.arthur.personId,
    childId: P.henry.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Records 1930 #30-811',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.clara_whitmore.personId,
    childId: P.henry.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Records 1930 #30-811',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Lydia is child of Henry Pemberton & Sarah Jenkins (biological)
  await addParentChildRelationship({
    parentId: P.henry.personId,
    childId: P.lydia.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Register 1958',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.sarah_jenkins.personId,
    childId: P.lydia.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Register 1958',
    reliabilityTier: 4,
    confidence: 95,
  });

  // Lucas & Hannah are children of Richard Montgomery & Lydia Pemberton (biological)
  await addParentChildRelationship({
    parentId: P.richard.personId,
    childId: P.lucas.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Register 1985 #85-1102',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.lydia.personId,
    childId: P.lucas.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Register 1985 #85-1102',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.richard.personId,
    childId: P.hannah.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Register 1990',
    reliabilityTier: 4,
    confidence: 95,
  });
  await addParentChildRelationship({
    parentId: P.lydia.personId,
    childId: P.hannah.personId,
    relationshipType: 'biological',
    citation: 'Hartford Hospital Birth Register 1990',
    reliabilityTier: 4,
    confidence: 95,
  });

  console.log('Parent-child relationships added.');

  // Ensure all ancestor closures are freshly refreshed and accurate
  await rebuildAllAncestorClosures();
  console.log('Ancestor closures verified and rebuilt.');

  // ==========================================
  // MEDIA ATTACHMENTS WITH CRYPTOGRAPHIC SHA-256
  // ==========================================
  console.log('Adding Media Documents with SHA-256 Checksums...');

  // SVG Certificate for Alexander Pemberton
  const certSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
    <rect width="800" height="600" fill="#fcfbf7" stroke="#b45309" stroke-width="8"/>
    <rect x="20" y="20" width="760" height="560" fill="none" stroke="#78350f" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="400" y="90" font-family="serif" font-size="28" font-weight="bold" fill="#78350f" text-anchor="middle">COMMONWEALTH OF MASSACHUSETTS</text>
    <text x="400" y="130" font-family="serif" font-size="20" fill="#92400e" text-anchor="middle">CERTIFICATE OF LIVE BIRTH</text>
    <line x1="150" y1="150" x2="650" y2="150" stroke="#b45309" stroke-width="1.5"/>
    <text x="150" y="200" font-family="sans-serif" font-size="14" fill="#57534e">Child's Full Name:</text>
    <text x="320" y="200" font-family="serif" font-size="18" font-weight="bold" fill="#1c1917">Alexander Pemberton</text>
    <text x="150" y="250" font-family="sans-serif" font-size="14" fill="#57534e">Date of Birth:</text>
    <text x="320" y="250" font-family="serif" font-size="18" font-weight="bold" fill="#1c1917">May 14, 1978 (11:42 PM)</text>
    <text x="150" y="300" font-family="sans-serif" font-size="14" fill="#57534e">Place of Birth:</text>
    <text x="320" y="300" font-family="serif" font-size="16" fill="#1c1917">Boston City Hospital, Boston, MA</text>
    <text x="150" y="350" font-family="sans-serif" font-size="14" fill="#57534e">Father's Name:</text>
    <text x="320" y="350" font-family="serif" font-size="16" fill="#1c1917">Charles Pemberton (Age 27)</text>
    <text x="150" y="400" font-family="sans-serif" font-size="14" fill="#57534e">Mother's Name:</text>
    <text x="320" y="400" font-family="serif" font-size="16" fill="#1c1917">Beatrice Hastings Pemberton (Age 26)</text>
    <text x="150" y="450" font-family="sans-serif" font-size="14" fill="#57534e">Registry File No:</text>
    <text x="320" y="450" font-family="monospace" font-size="16" fill="#b45309">#78-09142-BOS</text>
    <circle cx="620" cy="460" r="50" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
    <text x="620" y="455" font-family="serif" font-size="11" font-weight="bold" fill="#78350f" text-anchor="middle">OFFICIAL SEAL</text>
    <text x="620" y="475" font-family="serif" font-size="9" fill="#92400e" text-anchor="middle">DEPT OF VITAL RECORDS</text>
  </svg>`;
  const certDataUrl = `data:image/svg+xml;base64,${Buffer.from(certSvg).toString('base64')}`;

  const certMedia = await addPersonMedia({
    personId: P.alexander.personId,
    title: 'State Certified Birth Record #78-09142',
    mediaType: 'certificate',
    mimeType: 'image/svg+xml',
    fileSize: Buffer.byteLength(certSvg),
    fileUrl: certDataUrl,
    description: 'Official birth certificate issued by the Commonwealth of Massachusetts Department of Public Health.',
    uploadedBy: 'user-alice-pemberton',
  });

  console.log('Alexander birth certificate attached with SHA-256:', certMedia.sha256Checksum);

  // Archival Portrait for Arthur Pemberton
  const portraitSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="100%" height="100%">
    <rect width="600" height="750" fill="#292524"/>
    <rect x="25" y="25" width="550" height="700" fill="#1c1917" stroke="#78716c" stroke-width="3"/>
    <circle cx="300" cy="280" r="140" fill="#44403c" stroke="#d97706" stroke-width="2"/>
    <circle cx="300" cy="250" r="70" fill="#78716c"/>
    <path d="M 210 400 Q 300 340 390 400 L 390 480 L 210 480 Z" fill="#78716c"/>
    <rect x="270" y="320" width="60" height="40" fill="#1c1917"/>
    <text x="300" y="550" font-family="serif" font-size="24" font-style="italic" fill="#fbbf24" text-anchor="middle">Arthur Pemberton</text>
    <text x="300" y="585" font-family="serif" font-size="16" fill="#a8a29e" text-anchor="middle">Boston, Massachusetts • c. 1925</text>
    <text x="300" y="620" font-family="monospace" font-size="12" fill="#78716c" text-anchor="middle">Archival Glass Plate Negative #P-1895</text>
  </svg>`;
  const portraitDataUrl = `data:image/svg+xml;base64,${Buffer.from(portraitSvg).toString('base64')}`;

  const portraitMedia = await addPersonMedia({
    personId: P.arthur.personId,
    title: 'Arthur Pemberton Archival Portrait (1925)',
    mediaType: 'photo',
    mimeType: 'image/svg+xml',
    fileSize: Buffer.byteLength(portraitSvg),
    fileUrl: portraitDataUrl,
    description: 'Formal studio photograph taken at Pemberton & Co. studios in Boston, Massachusetts.',
    uploadedBy: 'user-alice-pemberton',
  });

  console.log('Arthur portrait attached with SHA-256:', portraitMedia.sha256Checksum);

  // ==========================================
  // IDENTITY RESOLUTION & MATCH CANDIDATES
  // Trigger duplicate candidate detection so the near-duplicate (Alex J. Pemberton)
  // appears as 'possible' in the review queue unmerged!
  // ==========================================
  console.log('Scanning Duplicate Candidates for Review Queue across all profiles...');
  const { scanned, generated } = await scanAllDuplicateCandidates();
  console.log(`Scan completed: Scanned ${scanned} records, generated ${generated} match candidate pairs.`);

  // Verify match candidate table
  const candidates = await db.select().from(matchCandidate);
  console.log(`Duplicate review queue now has ${candidates.length} match candidates.`);
  for (const cand of candidates) {
    console.log(`- Candidate: ${cand.personAId.slice(0, 8)} <-> ${cand.personBId.slice(0, 8)} | Score: ${cand.score}% | Band: ${cand.band} | Status: ${cand.status}`);
  }

  console.log('\n======================================================');
  console.log('  CURATED DEMO DATASET POPULATION COMPLETED!');
  console.log('======================================================');
}

seedCuratedDemoData()
  .then(() => {
    console.log('Seed completed cleanly.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
