import { db, createPool } from '../src/db/index.ts';
import {
  person,
  personClaim,
  source,
  parentChild,
  partnership,
  ancestorClosure,
  matchCandidate,
} from '../src/db/schema.ts';
import { eq, and, sql, or } from 'drizzle-orm';
import {
  soundex,
  stringSimilarity,
  parseFullName,
  extractBirthDecade,
} from '../src/utils/phonetics.ts';
import { scoreCandidatePair } from '../src/db/duplicateDetection.ts';
import { calculateRelationshipBetween } from '../src/db/relationships.ts';
import { performance } from 'perf_hooks';

// Surnames and Given Names pools for realistic synthetic generation
const SURNAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia',
  'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez',
  'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Lopez', 'Lee', 'Gonzalez',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall', 'Young',
  'Allen', 'Sanchez', 'Wright', 'King', 'Scott', 'Green', 'Baker', 'Adams',
  'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell',
  'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson',
  'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz',
  'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long',
  'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan',
  'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher', 'Vasquez'
];

const MALE_GIVEN_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Donald',
  'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'George', 'Joshua', 'Kevin',
  'Brian', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob',
  'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott',
  'Brandon', 'Benjamin', 'Samuel', 'Gregory', 'Alexander', 'Frank', 'Patrick',
  'Raymond', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Henry', 'Douglas'
];

const FEMALE_GIVEN_NAMES = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra',
  'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol',
  'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura',
  'Cynthia', 'Kathleen', 'Amy', 'Shirley', 'Angela', 'Helen', 'Anna', 'Brenda',
  'Pamela', 'Nicole', 'Emma', 'Samantha', 'Katherine', 'Christine', 'Debra',
  'Rachel', 'Catherine', 'Carolyn', 'Janet', 'Ruth', 'Maria', 'Heather', 'Diane'
];

const PLACES = [
  'Boston, Massachusetts', 'Philadelphia, Pennsylvania', 'Richmond, Virginia',
  'Charleston, South Carolina', 'New York, New York', 'London, England',
  'Edinburgh, Scotland', 'Dublin, Ireland', 'Baltimore, Maryland',
  'Providence, Rhode Island', 'Savannah, Georgia', 'Hartford, Connecticut',
  'Salem, Massachusetts', 'Williamsburg, Virginia', 'Albany, New York',
  'Portsmouth, New Hampshire', 'New Castle, Delaware', 'Bristol, England'
];

// Phonetic & Historical Name Variations for Deliberate Near-Duplicates
const NAME_VARIATIONS: Record<string, string[]> = {
  'Catherine': ['Katherine', 'Catharine', 'Kathryn', 'Katharine', 'Cathleen'],
  'Katherine': ['Catherine', 'Kathryn', 'Katharine', 'Catharine'],
  'Elizabeth': ['Elisabeth', 'Eliza', 'Beth', 'Betsy', 'Betty'],
  'Margaret': ['Margret', 'Marguerite', 'Maggie', 'Margot', 'Peggy'],
  'Sarah': ['Sara', 'Sallie', 'Sally'],
  'Mary': ['Marie', 'Maria', 'Polly', 'Mae'],
  'Anne': ['Ann', 'Anna', 'Hannah'],
  'Ann': ['Anne', 'Anna', 'Annie'],
  'John': ['Jon', 'Jonathan', 'Jonathon', 'Jack', 'Johann'],
  'William': ['Will', 'Bill', 'Willie', 'Liam', 'Willyam'],
  'James': ['Jim', 'Jimmie', 'Jimmy', 'Jaime'],
  'Robert': ['Rob', 'Bob', 'Robbie', 'Bobby', 'Rupert'],
  'Thomas': ['Tom', 'Tomas', 'Tommy'],
  'Charles': ['Charley', 'Charlie', 'Carl', 'Karl'],
  'Edward': ['Ed', 'Eddie', 'Ned', 'Ted'],
  'George': ['Jorge', 'Georgie'],
  'Henry': ['Harry', 'Henrie', 'Hank'],
  'Joseph': ['Joe', 'Joey', 'Josef'],
  'Richard': ['Rick', 'Dick', 'Richie', 'Rikard'],
  'Stephen': ['Steven', 'Stephan', 'Steve'],
  'Steven': ['Stephen', 'Steve', 'Stephan'],
  'Jeffrey': ['Geoffrey', 'Jeff', 'Jeffery'],
  'Geoffrey': ['Jeffrey', 'Jeffery', 'Jeff'],
  'Smith': ['Smyth', 'Smythe', 'Schmidt'],
  'Brown': ['Browne', 'Braun'],
  'Miller': ['Mueller', 'Muller', 'Millar'],
  'Davis': ['Davies', 'Daviss'],
  'Wilson': ['Willson', 'Wilsone'],
  'Taylor': ['Tayler', 'Tailor'],
  'Moore': ['Moor', 'More', 'Moores'],
  'Jackson': ['Jaxon', 'Jackman'],
  'White': ['Whyte', 'Wight'],
  'Harris': ['Harrys', 'Harries'],
  'Clark': ['Clarke', 'Clerk'],
  'Lewis': ['Louis', 'Lewes'],
  'Walker': ['Wallker', 'Walcker'],
  'Hall': ['Halle', 'Haul'],
  'Young': ['Younge', 'Jung'],
  'King': ['Kynge', 'Koenig'],
  'Wright': ['Right', 'Wryghte'],
  'Green': ['Greene', 'Grene'],
  'Baker': ['Bakere', 'Baeker'],
  'Adams': ['Addams', 'Adamson'],
  'Nelson': ['Nilsson', 'Neilsen'],
  'Campbell': ['Campbel', 'Cambell'],
  'Stewart': ['Stuart', 'Steward'],
  'Morris': ['Maurice', 'Morrice'],
  'Cook': ['Cooke', 'Koch'],
  'Rogers': ['Rodgers', 'Rogiers'],
  'Peterson': ['Petersen', 'Pieters'],
  'Reed': ['Reid', 'Read', 'Reade'],
  'Kelly': ['Kelley', 'Kellie'],
  'Howard': ['Howarde', 'Hauward'],
  'Cox': ['Cocks', 'Coxe'],
  'Ward': ['Warde', 'Wart'],
  'Watson': ['Wattson', 'Watsone'],
  'Brooks': ['Brookes', 'Broox']
};

interface SyntheticPerson {
  tempId: string;
  dbId?: string;
  gender: 'M' | 'F';
  givenName: string;
  surname: string;
  birthYear: number;
  birthDate: string;
  birthPlace: string;
  generation: number;
  fatherTempId?: string;
  motherTempId?: string;
  spouseTempIds: string[];
}

interface GroundTruthDuplicate {
  canonicalPersonId: string;
  duplicatePersonId: string;
  canonicalName: string;
  duplicateName: string;
  canonicalBirthDate: string;
  duplicateBirthDate: string;
  canonicalPlace: string;
  duplicatePlace: string;
}

export async function runSyntheticDatasetBenchmark() {
  console.log('========================================================================');
  console.log('   SYNTHETIC GENEALOGICAL DATASET GENERATOR & BENCHMARK SUITE');
  console.log('========================================================================\n');

  // Step 0: Clean existing test data or set up sources
  console.log('[1/5] Initializing Database & Sources...');
  
  // Insert primary and secondary sources
  const [sourcePrimary] = await db.insert(source).values({
    citation: 'Colonial Parish Registers and Vital Statistics Archives (Tier 1 Primary Evidence)',
    sourceType: 'vital_record',
    reliabilityTier: 1,
  }).returning();

  const [sourceSecondary] = await db.insert(source).values({
    citation: 'Federal Census and Municipal Historical Directory (Tier 2 Secondary Evidence)',
    sourceType: 'census',
    reliabilityTier: 2,
  }).returning();

  const [sourceBible] = await db.insert(source).values({
    citation: 'Transcribed Family Bible Records (Tier 3 Evidence)',
    sourceType: 'family_bible',
    reliabilityTier: 3,
  }).returning();

  console.log('✓ Sources initialized.\n');

  // Step 1: Generate 2,000 synthetic people with realistic multi-generational families
  console.log('[2/5] Generating 2,000 synthetic people with multi-generational families...');
  
  const syntheticPeople: SyntheticPerson[] = [];
  let idCounter = 1;
  const nextId = () => `synth_${idCounter++}`;

  // We will build 20 distinct family lineage trees, each with ~100 people across 5-6 generations
  const NUM_LINEAGES = 20;
  const TARGET_TOTAL = 2000;
  const cousinMarriagePairs: { person1TempId: string; person2TempId: string }[] = [];

  for (let l = 0; l < NUM_LINEAGES; l++) {
    const lineageSurname = SURNAMES[l % SURNAMES.length];
    const baseYear = 1800 + (l % 5) * 5; // 1800 - 1820
    const place = PLACES[l % PLACES.length];

    // Generation 0: Patriarch & Matriarch
    const g0Patriarch: SyntheticPerson = {
      tempId: nextId(),
      gender: 'M',
      givenName: MALE_GIVEN_NAMES[l % MALE_GIVEN_NAMES.length],
      surname: lineageSurname,
      birthYear: baseYear,
      birthDate: `${baseYear}-${String((l % 12) + 1).padStart(2, '0')}-15`,
      birthPlace: place,
      generation: 0,
      spouseTempIds: [],
    };

    const g0Matriarch: SyntheticPerson = {
      tempId: nextId(),
      gender: 'F',
      givenName: FEMALE_GIVEN_NAMES[l % FEMALE_GIVEN_NAMES.length],
      surname: SURNAMES[(l + 30) % SURNAMES.length],
      birthYear: baseYear + 2,
      birthDate: `${baseYear + 2}-${String(((l + 3) % 12) + 1).padStart(2, '0')}-20`,
      birthPlace: place,
      generation: 0,
      spouseTempIds: [],
    };

    g0Patriarch.spouseTempIds.push(g0Matriarch.tempId);
    g0Matriarch.spouseTempIds.push(g0Patriarch.tempId);

    syntheticPeople.push(g0Patriarch, g0Matriarch);

    // Generate subsequent generations (G1 to G5)
    let currentGenParents: { father: SyntheticPerson; mother: SyntheticPerson }[] = [
      { father: g0Patriarch, mother: g0Matriarch },
    ];

    const gen1Siblings: SyntheticPerson[] = [];
    const gen2Siblings: SyntheticPerson[] = [];

    for (let gen = 1; gen <= 5; gen++) {
      if (syntheticPeople.length >= TARGET_TOTAL) break;

      const nextGenParents: { father: SyntheticPerson; mother: SyntheticPerson }[] = [];
      const genYear = baseYear + gen * 25;

      for (let pIdx = 0; pIdx < currentGenParents.length; pIdx++) {
        if (syntheticPeople.length >= TARGET_TOTAL) break;

        const parentPair = currentGenParents[pIdx];
        const numChildren = 3 + ((l + gen + pIdx) % 3); // 3 to 5 children

        for (let c = 0; c < numChildren; c++) {
          if (syntheticPeople.length >= TARGET_TOTAL) break;

          const isMale = (l + gen + pIdx + c) % 2 === 0;
          const childGiven = isMale
            ? MALE_GIVEN_NAMES[(syntheticPeople.length + c) % MALE_GIVEN_NAMES.length]
            : FEMALE_GIVEN_NAMES[(syntheticPeople.length + c) % FEMALE_GIVEN_NAMES.length];
          const childSurname = parentPair.father.surname;
          const childBirthYear = genYear + c * 2;
          const childBirthDate = `${childBirthYear}-${String(((c * 3 + 1) % 12) + 1).padStart(2, '0')}-${String(((c * 5 + 1) % 28) + 1).padStart(2, '0')}`;

          const child: SyntheticPerson = {
            tempId: nextId(),
            gender: isMale ? 'M' : 'F',
            givenName: childGiven,
            surname: childSurname,
            birthYear: childBirthYear,
            birthDate: childBirthDate,
            birthPlace: PLACES[(l + gen + c) % PLACES.length],
            generation: gen,
            fatherTempId: parentPair.father.tempId,
            motherTempId: parentPair.mother.tempId,
            spouseTempIds: [],
          };

          syntheticPeople.push(child);

          if (gen === 1) gen1Siblings.push(child);
          if (gen === 2) gen2Siblings.push(child);

          // Give spouse to ~75% of children in generations 1-4 to propagate tree
          if (gen < 5 && c < 3 && syntheticPeople.length < TARGET_TOTAL) {
            const spouseGiven = isMale
              ? FEMALE_GIVEN_NAMES[(syntheticPeople.length * 7) % FEMALE_GIVEN_NAMES.length]
              : MALE_GIVEN_NAMES[(syntheticPeople.length * 7) % MALE_GIVEN_NAMES.length];
            const spouseSurname = SURNAMES[(syntheticPeople.length * 13) % SURNAMES.length];
            const spouseBirthYear = childBirthYear + (isMale ? -1 : 1);
            const spouseBirthDate = `${spouseBirthYear}-06-12`;

            const spouse: SyntheticPerson = {
              tempId: nextId(),
              gender: isMale ? 'F' : 'M',
              givenName: spouseGiven,
              surname: spouseSurname,
              birthYear: spouseBirthYear,
              birthDate: spouseBirthDate,
              birthPlace: PLACES[(l + gen + 2) % PLACES.length],
              generation: gen,
              spouseTempIds: [child.tempId],
            };

            child.spouseTempIds.push(spouse.tempId);
            syntheticPeople.push(spouse);

            if (isMale) {
              nextGenParents.push({ father: child, mother: spouse });
            } else {
              nextGenParents.push({ father: spouse, mother: child });
            }
          }
        }
      }

      currentGenParents = nextGenParents;
    }

    // Add intentional Cousin Marriages (Pedigree Collapse) in generation 2/3
    if (gen2Siblings.length >= 4) {
      // Find two first-cousins (children of distinct gen1 siblings)
      const maleCousin = gen2Siblings.find((p) => p.gender === 'M');
      const femaleCousin = gen2Siblings.find(
        (p) => p.gender === 'F' && p.fatherTempId !== maleCousin?.fatherTempId
      );

      if (maleCousin && femaleCousin && !maleCousin.spouseTempIds.includes(femaleCousin.tempId)) {
        maleCousin.spouseTempIds.push(femaleCousin.tempId);
        femaleCousin.spouseTempIds.push(maleCousin.tempId);
        cousinMarriagePairs.push({
          person1TempId: maleCousin.tempId,
          person2TempId: femaleCousin.tempId,
        });
      }
    }
  }

  console.log(`✓ Generated ${syntheticPeople.length} synthetic people structure.`);
  console.log(`✓ Created ${cousinMarriagePairs.length} intentional cousin marriages for pedigree collapse testing.`);

  // Insert synthetic people into DB in efficient chunks
  console.log('\nInserting synthetic records into Cloud SQL PostgreSQL in batches...');
  const tempToDbId = new Map<string, string>();

  // 1. Insert Person rows
  const personBatchSize = 400;
  for (let i = 0; i < syntheticPeople.length; i += personBatchSize) {
    const chunk = syntheticPeople.slice(i, i + personBatchSize);
    const personValues = chunk.map(() => ({
      isLiving: false,
      privacyLevel: 'public',
      createdBy: 'synthetic_generator',
    }));

    const inserted = await db.insert(person).values(personValues).returning({ personId: person.personId });
    inserted.forEach((row, idx) => {
      tempToDbId.set(chunk[idx].tempId, row.personId);
      chunk[idx].dbId = row.personId;
    });
  }

  // 2. Insert Claims (Name, Birth Date, Birth Place)
  const allClaims: {
    personId: string;
    attributeType: string;
    value: string;
    sourceId: string;
    confidence: number;
    submittedBy: string;
    status: string;
  }[] = [];

  syntheticPeople.forEach((p) => {
    const dbId = tempToDbId.get(p.tempId)!;
    // Name claim
    allClaims.push({
      personId: dbId,
      attributeType: 'name',
      value: `${p.givenName} ${p.surname}`,
      sourceId: sourcePrimary.sourceId,
      confidence: 5,
      submittedBy: 'synthetic_generator',
      status: 'active',
    });
    // Birth date claim
    allClaims.push({
      personId: dbId,
      attributeType: 'birth_date',
      value: p.birthDate,
      sourceId: sourcePrimary.sourceId,
      confidence: 5,
      submittedBy: 'synthetic_generator',
      status: 'active',
    });
    // Birth place claim
    allClaims.push({
      personId: dbId,
      attributeType: 'birth_place',
      value: p.birthPlace,
      sourceId: sourceSecondary.sourceId,
      confidence: 4,
      submittedBy: 'synthetic_generator',
      status: 'active',
    });
  });

  const claimBatchSize = 600;
  for (let i = 0; i < allClaims.length; i += claimBatchSize) {
    const chunk = allClaims.slice(i, i + claimBatchSize);
    await db.insert(personClaim).values(chunk);
  }

  // 3. Insert Parent-Child relationships
  const parentChildValues: {
    parentId: string;
    childId: string;
    relationshipType: string;
    sourceId: string;
    confidence: number;
  }[] = [];

  syntheticPeople.forEach((p) => {
    const childDbId = tempToDbId.get(p.tempId)!;
    if (p.fatherTempId && tempToDbId.has(p.fatherTempId)) {
      parentChildValues.push({
        parentId: tempToDbId.get(p.fatherTempId)!,
        childId: childDbId,
        relationshipType: 'biological',
        sourceId: sourcePrimary.sourceId,
        confidence: 5,
      });
    }
    if (p.motherTempId && tempToDbId.has(p.motherTempId)) {
      parentChildValues.push({
        parentId: tempToDbId.get(p.motherTempId)!,
        childId: childDbId,
        relationshipType: 'biological',
        sourceId: sourcePrimary.sourceId,
        confidence: 5,
      });
    }
  });

  for (let i = 0; i < parentChildValues.length; i += 400) {
    const chunk = parentChildValues.slice(i, i + 400);
    await db.insert(parentChild).values(chunk);
  }

  // 4. Insert Partnerships (Marriages)
  const partnershipValues: {
    person1Id: string;
    person2Id: string;
    unionType: string;
    startDate: string;
    sourceId: string;
  }[] = [];

  const addedPartnershipPairs = new Set<string>();
  syntheticPeople.forEach((p) => {
    const db1 = tempToDbId.get(p.tempId)!;
    p.spouseTempIds.forEach((sTempId) => {
      const db2 = tempToDbId.get(sTempId);
      if (!db2) return;
      const key = db1 < db2 ? `${db1}_${db2}` : `${db2}_${db1}`;
      if (!addedPartnershipPairs.has(key)) {
        addedPartnershipPairs.add(key);
        partnershipValues.push({
          person1Id: db1,
          person2Id: db2,
          unionType: 'marriage',
          startDate: `${p.birthYear + 22}-05-18`,
          sourceId: sourceSecondary.sourceId,
        });
      }
    });
  });

  for (let i = 0; i < partnershipValues.length; i += 400) {
    const chunk = partnershipValues.slice(i, i + 400);
    await db.insert(partnership).values(chunk);
  }

  console.log(`✓ Inserted ${syntheticPeople.length} people, ${allClaims.length} claims, ${parentChildValues.length} parent-child links, and ${partnershipValues.length} partnerships.`);

  // Step 2: Generate 200 deliberate near-duplicate records with known ground truth
  console.log('\n[3/5] Generating 200 deliberate near-duplicate records with known ground truth...');
  
  // Pick 200 distinct people spread across the synthetic dataset
  const step = Math.max(1, Math.floor(syntheticPeople.length / 200));
  const selectedTargets: SyntheticPerson[] = [];
  for (let i = 0; i < syntheticPeople.length && selectedTargets.length < 200; i += step) {
    selectedTargets.push(syntheticPeople[i]);
  }

  const groundTruthDuplicates: GroundTruthDuplicate[] = [];
  const duplicatePersonRecords: {
    isLiving: boolean;
    privacyLevel: string;
    createdBy: string;
  }[] = [];

  const duplicateClaims: {
    tempCanonicalId: string;
    variantName: string;
    variantBirthDate: string;
    variantPlace: string;
  }[] = [];

  selectedTargets.forEach((target, idx) => {
    // Generate name variant
    let variantGiven = target.givenName;
    let variantSurname = target.surname;

    // Check given name variants
    if (NAME_VARIATIONS[target.givenName]) {
      const vars = NAME_VARIATIONS[target.givenName];
      variantGiven = vars[idx % vars.length];
    } else {
      // Minor typo or vowel substitution
      if (variantGiven.endsWith('e')) variantGiven = variantGiven.slice(0, -1);
      else variantGiven = variantGiven + 'e';
    }

    // Check surname variants
    if (NAME_VARIATIONS[target.surname]) {
      const vars = NAME_VARIATIONS[target.surname];
      variantSurname = vars[idx % vars.length];
    } else {
      if (variantSurname.endsWith('s')) variantSurname = variantSurname + 'e';
      else if (variantSurname.includes('ll')) variantSurname = variantSurname.replace('ll', 'l');
      else variantSurname = variantSurname + 'e';
    }

    // Birth year variation (+/- 1 to 3 years census error)
    const yearDelta = ((idx % 5) - 2); // -2, -1, 0, 1, 2
    const variantYear = target.birthYear + (yearDelta === 0 ? 1 : yearDelta);
    const variantMonth = String(((idx * 4 + 2) % 12) + 1).padStart(2, '0');
    const variantDay = String(((idx * 7 + 3) % 28) + 1).padStart(2, '0');
    const variantBirthDate = `${variantYear}-${variantMonth}-${variantDay}`;

    // Place variant (abbreviation or county)
    let variantPlace = target.birthPlace;
    if (variantPlace.includes('Massachusetts')) variantPlace = variantPlace.replace('Massachusetts', 'MA');
    else if (variantPlace.includes('Pennsylvania')) variantPlace = variantPlace.replace('Pennsylvania', 'PA');
    else if (variantPlace.includes('Virginia')) variantPlace = variantPlace.replace('Virginia', 'VA');
    else if (variantPlace.includes('England')) variantPlace = variantPlace.replace('England', 'UK');
    else variantPlace = variantPlace + ' County';

    duplicatePersonRecords.push({
      isLiving: false,
      privacyLevel: 'public',
      createdBy: 'deliberate_duplicate_generator',
    });

    duplicateClaims.push({
      tempCanonicalId: target.tempId,
      variantName: `${variantGiven} ${variantSurname}`,
      variantBirthDate,
      variantPlace,
    });
  });

  // Insert 200 duplicate person rows
  const insertedDuplicates = await db.insert(person).values(duplicatePersonRecords).returning({ personId: person.personId });

  const dupClaimsToInsert: any[] = [];
  const dupParentChildLinks: any[] = [];

  insertedDuplicates.forEach((dupRow, idx) => {
    const dupInfo = duplicateClaims[idx];
    const canonicalDbId = tempToDbId.get(dupInfo.tempCanonicalId)!;
    const targetObj = selectedTargets[idx];

    groundTruthDuplicates.push({
      canonicalPersonId: canonicalDbId,
      duplicatePersonId: dupRow.personId,
      canonicalName: `${targetObj.givenName} ${targetObj.surname}`,
      duplicateName: dupInfo.variantName,
      canonicalBirthDate: targetObj.birthDate,
      duplicateBirthDate: dupInfo.variantBirthDate,
      canonicalPlace: targetObj.birthPlace,
      duplicatePlace: dupInfo.variantPlace,
    });

    // Claims for duplicate
    dupClaimsToInsert.push({
      personId: dupRow.personId,
      attributeType: 'name',
      value: dupInfo.variantName,
      sourceId: sourceBible.sourceId,
      confidence: 3,
      submittedBy: 'deliberate_duplicate_generator',
      status: 'active',
    });

    dupClaimsToInsert.push({
      personId: dupRow.personId,
      attributeType: 'birth_date',
      value: dupInfo.variantBirthDate,
      sourceId: sourceBible.sourceId,
      confidence: 3,
      submittedBy: 'deliberate_duplicate_generator',
      status: 'active',
    });

    dupClaimsToInsert.push({
      personId: dupRow.personId,
      attributeType: 'birth_place',
      value: dupInfo.variantPlace,
      sourceId: sourceBible.sourceId,
      confidence: 3,
      submittedBy: 'deliberate_duplicate_generator',
      status: 'active',
    });

    // In 65% of duplicate cases, link duplicate person to same parents (common in real family trees)
    if (idx % 3 !== 0 && targetObj.fatherTempId && tempToDbId.has(targetObj.fatherTempId)) {
      dupParentChildLinks.push({
        parentId: tempToDbId.get(targetObj.fatherTempId)!,
        childId: dupRow.personId,
        relationshipType: 'biological',
        sourceId: sourceBible.sourceId,
        confidence: 3,
      });
    }
  });

  for (let i = 0; i < dupClaimsToInsert.length; i += 400) {
    await db.insert(personClaim).values(dupClaimsToInsert.slice(i, i + 400));
  }

  if (dupParentChildLinks.length > 0) {
    for (let i = 0; i < dupParentChildLinks.length; i += 400) {
      await db.insert(parentChild).values(dupParentChildLinks.slice(i, i + 400));
    }
  }

  console.log(`✓ Inserted 200 deliberate near-duplicate records with known ground truth.`);
  console.log(`✓ Ground Truth Pair Count: ${groundTruthDuplicates.length} pairs.\n`);

  // Build ground truth lookup set (both directions normalized)
  const groundTruthSet = new Set<string>();
  groundTruthDuplicates.forEach((g) => {
    const key = g.canonicalPersonId < g.duplicatePersonId
      ? `${g.canonicalPersonId}_${g.duplicatePersonId}`
      : `${g.duplicatePersonId}_${g.canonicalPersonId}`;
    groundTruthSet.add(key);
  });

  // Step 3: Run Identity Resolution Algorithm against the dataset
  console.log('[4/5] Running Identity Resolution Algorithm (Soundex Blocking + Multi-Factor Scoring)...');
  
  // Re-fetch all persons and active claims to build profile summaries in memory for rapid evaluation
  const allPeopleInDb = await db.select().from(person);
  const allClaimsInDb = await db.select().from(personClaim).where(eq(personClaim.status, 'active'));
  const allParentChild = await db.select().from(parentChild);
  const allPartnershipsInDb = await db.select().from(partnership);

  // Group claims by person
  const claimsByPerson = new Map<string, any[]>();
  allClaimsInDb.forEach((c) => {
    if (!claimsByPerson.has(c.personId)) claimsByPerson.set(c.personId, []);
    claimsByPerson.get(c.personId)!.push(c);
  });

  // Parent and Spouse maps
  const parentsByPerson = new Map<string, Set<string>>();
  allParentChild.forEach((pc) => {
    if (!parentsByPerson.has(pc.childId)) parentsByPerson.set(pc.childId, new Set());
    parentsByPerson.get(pc.childId)!.add(pc.parentId);
  });

  const spousesByPerson = new Map<string, Set<string>>();
  allPartnershipsInDb.forEach((p) => {
    if (!spousesByPerson.has(p.person1Id)) spousesByPerson.set(p.person1Id, new Set());
    if (!spousesByPerson.has(p.person2Id)) spousesByPerson.set(p.person2Id, new Set());
    spousesByPerson.get(p.person1Id)!.add(p.person2Id);
    spousesByPerson.get(p.person2Id)!.add(p.person1Id);
  });

  // Build profile summaries
  const profileSummaries: any[] = [];
  const blockingBuckets = new Map<string, any[]>();

  allPeopleInDb.forEach((p) => {
    const claims = claimsByPerson.get(p.personId) || [];
    const nameClaim = claims.find((c) => c.attributeType === 'name')?.value || '';
    const birthClaim = claims.find((c) => c.attributeType === 'birth_date')?.value || '';
    const placeClaim = claims.find((c) => c.attributeType === 'birth_place')?.value || '';

    const { given, surname } = parseFullName(nameClaim);
    const surnameSoundex = soundex(surname);
    const { year: birthYear, decade: birthDecade, decadeKey: birthDecadeKey } = extractBirthDecade(birthClaim);

    const profile = {
      personId: p.personId,
      isLiving: p.isLiving,
      mergedInto: p.mergedInto,
      name: nameClaim,
      givenName: given,
      surname,
      surnameSoundex,
      birthDate: birthClaim,
      birthYear,
      birthDecade,
      birthDecadeKey,
      birthPlace: placeClaim,
      parentPersonIds: parentsByPerson.get(p.personId) || new Set<string>(),
      spousePersonIds: spousesByPerson.get(p.personId) || new Set<string>(),
      claims,
    };

    profileSummaries.push(profile);

    // Phonetic blocking key: Soundex(surname) + birth decade
    const blockingKey = `${surnameSoundex}_${birthDecadeKey}`;
    if (!blockingBuckets.has(blockingKey)) blockingBuckets.set(blockingKey, []);
    blockingBuckets.get(blockingKey)!.push(profile);
  });

  console.log(`✓ Total People Profiled: ${profileSummaries.length}`);
  console.log(`✓ Total Phonetic Blocking Buckets: ${blockingBuckets.size}`);

  // Evaluate candidate pairs in each blocking bucket
  interface CandidateMatchResult {
    personAId: string;
    personBId: string;
    score: number;
    band: string;
    isGroundTruth: boolean;
    nameA: string;
    nameB: string;
  }

  const allEvaluatedCandidates: CandidateMatchResult[] = [];
  const evaluatedPairsSet = new Set<string>();

  for (const [blockKey, bucket] of blockingBuckets.entries()) {
    if (bucket.length < 2) continue;

    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const pA = bucket[i];
        const pB = bucket[j];
        const pairKey = pA.personId < pB.personId
          ? `${pA.personId}_${pB.personId}`
          : `${pB.personId}_${pA.personId}`;

        if (evaluatedPairsSet.has(pairKey)) continue;
        evaluatedPairsSet.add(pairKey);

        const breakdown = scoreCandidatePair(pA, pB);
        const isTrueDup = groundTruthSet.has(pairKey);

        allEvaluatedCandidates.push({
          personAId: pA.personId,
          personBId: pB.personId,
          score: breakdown.totalScore,
          band: breakdown.band,
          isGroundTruth: isTrueDup,
          nameA: pA.name,
          nameB: pB.name,
        });
      }
    }
  }

  console.log(`✓ Evaluated Candidate Pairs: ${allEvaluatedCandidates.length}`);

  // Compute Precision, Recall, F1
  // 1. Overall Candidate Match Band (Strong + Possible: score >= 40)
  const candidateMatches = allEvaluatedCandidates.filter((c) => c.score >= 40);
  const TP_cand = candidateMatches.filter((c) => c.isGroundTruth).length;
  const FP_cand = candidateMatches.filter((c) => !c.isGroundTruth).length;
  const FN_cand = groundTruthDuplicates.length - TP_cand;
  const precision_cand = candidateMatches.length > 0 ? TP_cand / (TP_cand + FP_cand) : 0;
  const recall_cand = groundTruthDuplicates.length > 0 ? TP_cand / (TP_cand + FN_cand) : 0;
  const f1_cand = precision_cand + recall_cand > 0 ? (2 * precision_cand * recall_cand) / (precision_cand + recall_cand) : 0;

  // 2. Strong Match Band (score >= 75)
  const strongMatches = allEvaluatedCandidates.filter((c) => c.band === 'strong');
  const TP_strong = strongMatches.filter((c) => c.isGroundTruth).length;
  const FP_strong = strongMatches.filter((c) => !c.isGroundTruth).length;
  const FN_strong = groundTruthDuplicates.length - TP_strong;
  const precision_strong = strongMatches.length > 0 ? TP_strong / (TP_strong + FP_strong) : 0;
  const recall_strong = groundTruthDuplicates.length > 0 ? TP_strong / (TP_strong + FN_strong) : 0;
  const f1_strong = precision_strong + recall_strong > 0 ? (2 * precision_strong * recall_strong) / (precision_strong + recall_strong) : 0;

  // 3. Possible Match Band (40 <= score < 75)
  const possibleMatches = allEvaluatedCandidates.filter((c) => c.band === 'possible');
  const TP_possible = possibleMatches.filter((c) => c.isGroundTruth).length;
  const FP_possible = possibleMatches.filter((c) => !c.isGroundTruth).length;

  console.log('\n========================================================================');
  console.log('            IDENTITY-RESOLUTION EVALUATION REPORT');
  console.log('========================================================================');
  console.log(`Ground Truth True Duplicate Pairs : ${groundTruthDuplicates.length}`);
  console.log(`Total Candidate Pairs Generated   : ${allEvaluatedCandidates.length}`);
  console.log('------------------------------------------------------------------------');
  console.log('1. CANDIDATE MATCHES (Strong + Possible, Score >= 40):');
  console.log(`   - True Positives (TP)  : ${TP_cand}`);
  console.log(`   - False Positives (FP) : ${FP_cand}`);
  console.log(`   - False Negatives (FN) : ${FN_cand}`);
  console.log(`   - Precision            : ${(precision_cand * 100).toFixed(2)}% (${precision_cand.toFixed(4)})`);
  console.log(`   - Recall               : ${(recall_cand * 100).toFixed(2)}% (${recall_cand.toFixed(4)})`);
  console.log(`   - F1-Score             : ${(f1_cand * 100).toFixed(2)}% (${f1_cand.toFixed(4)})`);
  console.log('------------------------------------------------------------------------');
  console.log('2. HIGH CONFIDENCE STRONG MATCH BAND (Score >= 75):');
  console.log(`   - True Positives (TP)  : ${TP_strong}`);
  console.log(`   - False Positives (FP) : ${FP_strong}`);
  console.log(`   - False Negatives (FN) : ${FN_strong}`);
  console.log(`   - Precision            : ${(precision_strong * 100).toFixed(2)}% (${precision_strong.toFixed(4)})`);
  console.log(`   - Recall               : ${(recall_strong * 100).toFixed(2)}% (${recall_strong.toFixed(4)})`);
  console.log(`   - F1-Score             : ${(f1_strong * 100).toFixed(2)}% (${f1_strong.toFixed(4)})`);
  console.log('------------------------------------------------------------------------');
  console.log('3. POSSIBLE MATCH BAND (40 <= Score < 75):');
  console.log(`   - Flagged for Review   : ${possibleMatches.length}`);
  console.log(`   - True Duplicates in Band: ${TP_possible}`);
  console.log(`   - Non-Duplicates in Band : ${FP_possible}`);
  console.log('========================================================================\n');

  // Step 4: Populate ancestor_closure table for benchmarking
  console.log('[5/5] Building Ancestor Closure Table & Timing 20 Relationship Queries...');
  
  // Compute ancestor_closure table using in-memory transitive graph computation and batch insert
  const childToParentsMap = new Map<string, string[]>();
  allParentChild.forEach((pc) => {
    if (!childToParentsMap.has(pc.childId)) childToParentsMap.set(pc.childId, []);
    childToParentsMap.get(pc.childId)!.push(pc.parentId);
  });

  const closureRowsToInsert: { descendantId: string; ancestorId: string; generations: number }[] = [];

  allPeopleInDb.forEach((p) => {
    const dId = p.personId;
    const minGens = new Map<string, number>();
    const queue: { personId: string; depth: number }[] = [{ personId: dId, depth: 0 }];
    const bestDepth = new Map<string, number>();
    bestDepth.set(dId, 0);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.depth >= 10) continue;

      const parents = childToParentsMap.get(curr.personId) || [];
      for (const pId of parents) {
        const nextDepth = curr.depth + 1;
        const currentMin = minGens.get(pId);
        if (currentMin === undefined || nextDepth < currentMin) {
          minGens.set(pId, nextDepth);
        }

        const prevDepth = bestDepth.get(pId);
        if (prevDepth === undefined || nextDepth < prevDepth) {
          bestDepth.set(pId, nextDepth);
          queue.push({ personId: pId, depth: nextDepth });
        }
      }
    }

    for (const [ancId, gens] of minGens.entries()) {
      closureRowsToInsert.push({
        descendantId: dId,
        ancestorId: ancId,
        generations: gens,
      });
    }
  });

  // Clear existing closure rows and batch insert
  await db.delete(ancestorClosure);
  const closureChunkSize = 500;
  for (let i = 0; i < closureRowsToInsert.length; i += closureChunkSize) {
    const chunk = closureRowsToInsert.slice(i, i + closureChunkSize);
    await db.insert(ancestorClosure).values(chunk);
  }
  console.log(`✓ Populated ancestor_closure table with ${closureRowsToInsert.length} transitive rows.`);

  // Step 5: Benchmark 20 Relationship Calculator Queries
  // Select 20 pairs covering a broad variety of genealogical distances:
  const testPairs: {
    description: string;
    personAId: string;
    personBId: string;
    nameA: string;
    nameB: string;
  }[] = [];

  // 1. Parent - Child
  const pcLink = parentChildValues[0];
  const pA_1 = syntheticPeople.find((p) => tempToDbId.get(p.tempId) === pcLink.parentId)!;
  const pB_1 = syntheticPeople.find((p) => tempToDbId.get(p.tempId) === pcLink.childId)!;
  testPairs.push({
    description: 'Parent - Child (1 Gen)',
    personAId: pcLink.parentId,
    personBId: pcLink.childId,
    nameA: `${pA_1.givenName} ${pA_1.surname}`,
    nameB: `${pB_1.givenName} ${pB_1.surname}`,
  });

  // 2. Full Siblings (Gen 1)
  const sibs1 = syntheticPeople.filter((p) => p.generation === 1 && p.fatherTempId && p.fatherTempId === syntheticPeople[0].tempId);
  if (sibs1.length >= 2) {
    testPairs.push({
      description: 'Full Siblings (1 & 1 Gen)',
      personAId: tempToDbId.get(sibs1[0].tempId)!,
      personBId: tempToDbId.get(sibs1[1].tempId)!,
      nameA: `${sibs1[0].givenName} ${sibs1[0].surname}`,
      nameB: `${sibs1[1].givenName} ${sibs1[1].surname}`,
    });
  }

  // 3. Grandparent - Grandchild (2 Gens)
  const g2People = syntheticPeople.filter((p) => p.generation === 2 && p.fatherTempId);
  const gpTarget = syntheticPeople.find((p) => p.generation === 0)!;
  const gcTarget = g2People.find((p) => {
    const parent = syntheticPeople.find((x) => x.tempId === p.fatherTempId);
    return parent && (parent.fatherTempId === gpTarget.tempId || parent.motherTempId === gpTarget.tempId);
  }) || g2People[0];
  testPairs.push({
    description: 'Grandparent - Grandchild (2 Gens)',
    personAId: tempToDbId.get(gpTarget.tempId)!,
    personBId: tempToDbId.get(gcTarget.tempId)!,
    nameA: `${gpTarget.givenName} ${gpTarget.surname}`,
    nameB: `${gcTarget.givenName} ${gcTarget.surname}`,
  });

  // 4. Aunt/Uncle - Niece/Nephew (1 & 2 Gens)
  if (sibs1.length >= 2 && gcTarget.fatherTempId) {
    const uncle = sibs1.find((s) => s.tempId !== gcTarget.fatherTempId) || sibs1[1];
    testPairs.push({
      description: 'Aunt/Uncle - Niece/Nephew (1 & 2 Gens)',
      personAId: tempToDbId.get(uncle.tempId)!,
      personBId: tempToDbId.get(gcTarget.tempId)!,
      nameA: `${uncle.givenName} ${uncle.surname}`,
      nameB: `${gcTarget.givenName} ${gcTarget.surname}`,
    });
  }

  // 5. 1st Cousins (2 & 2 Gens)
  const g2List = syntheticPeople.filter((p) => p.generation === 2 && p.fatherTempId);
  const cousin1 = g2List[0];
  const cousin2 = g2List.find((p) => p.fatherTempId !== cousin1.fatherTempId) || g2List[1];
  testPairs.push({
    description: '1st Cousins (2 & 2 Gens)',
    personAId: tempToDbId.get(cousin1.tempId)!,
    personBId: tempToDbId.get(cousin2.tempId)!,
    nameA: `${cousin1.givenName} ${cousin1.surname}`,
    nameB: `${cousin2.givenName} ${cousin2.surname}`,
  });

  // 6. 1st Cousins Once Removed (2 & 3 Gens)
  const g3List = syntheticPeople.filter((p) => p.generation === 3 && p.fatherTempId);
  const g3Target = g3List[0] || syntheticPeople[10];
  testPairs.push({
    description: '1st Cousins Once Removed (2 & 3 Gens)',
    personAId: tempToDbId.get(cousin1.tempId)!,
    personBId: tempToDbId.get(g3Target.tempId)!,
    nameA: `${cousin1.givenName} ${cousin1.surname}`,
    nameB: `${g3Target.givenName} ${g3Target.surname}`,
  });

  // 7. 2nd Cousins (3 & 3 Gens)
  const g3Cousin1 = g3List[0];
  const g3Cousin2 = g3List.find((p) => p.fatherTempId !== g3Cousin1?.fatherTempId) || g3List[1] || syntheticPeople[15];
  testPairs.push({
    description: '2nd Cousins (3 & 3 Gens)',
    personAId: tempToDbId.get(g3Cousin1.tempId)!,
    personBId: tempToDbId.get(g3Cousin2.tempId)!,
    nameA: `${g3Cousin1.givenName} ${g3Cousin1.surname}`,
    nameB: `${g3Cousin2.givenName} ${g3Cousin2.surname}`,
  });

  // 8. 2nd Cousins Once Removed (3 & 4 Gens)
  const g4List = syntheticPeople.filter((p) => p.generation === 4 && p.fatherTempId);
  const g4Target = g4List[0] || syntheticPeople[20];
  testPairs.push({
    description: '2nd Cousins Once Removed (3 & 4 Gens)',
    personAId: tempToDbId.get(g3Cousin1.tempId)!,
    personBId: tempToDbId.get(g4Target.tempId)!,
    nameA: `${g3Cousin1.givenName} ${g3Cousin1.surname}`,
    nameB: `${g4Target.givenName} ${g4Target.surname}`,
  });

  // 9. 3rd Cousins (4 & 4 Gens)
  const g4Cousin1 = g4List[0] || syntheticPeople[25];
  const g4Cousin2 = g4List.find((p) => p.fatherTempId !== g4Cousin1?.fatherTempId) || g4List[1] || syntheticPeople[30];
  testPairs.push({
    description: '3rd Cousins (4 & 4 Gens)',
    personAId: tempToDbId.get(g4Cousin1.tempId)!,
    personBId: tempToDbId.get(g4Cousin2.tempId)!,
    nameA: `${g4Cousin1.givenName} ${g4Cousin1.surname}`,
    nameB: `${g4Cousin2.givenName} ${g4Cousin2.surname}`,
  });

  // 10. 3rd Cousins Twice Removed (3 & 5 Gens)
  const g5List = syntheticPeople.filter((p) => p.generation === 5 && p.fatherTempId);
  const g5Target = g5List[0] || syntheticPeople[35];
  testPairs.push({
    description: '3rd Cousins Twice Removed (3 & 5 Gens)',
    personAId: tempToDbId.get(g3Cousin1.tempId)!,
    personBId: tempToDbId.get(g5Target.tempId)!,
    nameA: `${g3Cousin1.givenName} ${g3Cousin1.surname}`,
    nameB: `${g5Target.givenName} ${g5Target.surname}`,
  });

  // 11. 4th Cousins (5 & 5 Gens)
  const g5Cousin1 = g5List[0] || syntheticPeople[40];
  const g5Cousin2 = g5List.find((p) => p.fatherTempId !== g5Cousin1?.fatherTempId) || g5List[1] || syntheticPeople[45];
  testPairs.push({
    description: '4th Cousins (5 & 5 Gens)',
    personAId: tempToDbId.get(g5Cousin1.tempId)!,
    personBId: tempToDbId.get(g5Cousin2.tempId)!,
    nameA: `${g5Cousin1.givenName} ${g5Cousin1.surname}`,
    nameB: `${g5Cousin2.givenName} ${g5Cousin2.surname}`,
  });

  // 12. Great-Grandparent - Great-Grandchild (3 Gens)
  testPairs.push({
    description: 'Great-Grandparent - Great-Grandchild (3 Gens)',
    personAId: tempToDbId.get(gpTarget.tempId)!,
    personBId: tempToDbId.get(g3Target.tempId)!,
    nameA: `${gpTarget.givenName} ${gpTarget.surname}`,
    nameB: `${g3Target.givenName} ${g3Target.surname}`,
  });

  // 13. 2nd Great-Grandparent (4 Gens)
  testPairs.push({
    description: '2nd Great-Grandparent (4 Gens)',
    personAId: tempToDbId.get(gpTarget.tempId)!,
    personBId: tempToDbId.get(g4Target.tempId)!,
    nameA: `${gpTarget.givenName} ${gpTarget.surname}`,
    nameB: `${g4Target.givenName} ${g4Target.surname}`,
  });

  // 14. 3rd Great-Grandparent (5 Gens)
  testPairs.push({
    description: '3rd Great-Grandparent (5 Gens)',
    personAId: tempToDbId.get(gpTarget.tempId)!,
    personBId: tempToDbId.get(g5Target.tempId)!,
    nameA: `${gpTarget.givenName} ${gpTarget.surname}`,
    nameB: `${g5Target.givenName} ${g5Target.surname}`,
  });

  // 15. Cousin Marriage / Pedigree Collapse Pair 1
  if (cousinMarriagePairs.length > 0) {
    const cm = cousinMarriagePairs[0];
    const p1 = syntheticPeople.find((x) => x.tempId === cm.person1TempId)!;
    const p2 = syntheticPeople.find((x) => x.tempId === cm.person2TempId)!;
    testPairs.push({
      description: 'Pedigree Collapse / 1st Cousin Marriage Partners',
      personAId: tempToDbId.get(cm.person1TempId)!,
      personBId: tempToDbId.get(cm.person2TempId)!,
      nameA: `${p1.givenName} ${p1.surname}`,
      nameB: `${p2.givenName} ${p2.surname}`,
    });
  }

  // 16. Cousin Marriage / Pedigree Collapse Pair 2 (Offspring of cousin marriage)
  if (cousinMarriagePairs.length > 1) {
    const cm = cousinMarriagePairs[1];
    const p1 = syntheticPeople.find((x) => x.tempId === cm.person1TempId)!;
    const p2 = syntheticPeople.find((x) => x.tempId === cm.person2TempId)!;
    testPairs.push({
      description: 'Pedigree Collapse Pair 2 (2nd Cousin Marriage)',
      personAId: tempToDbId.get(cm.person1TempId)!,
      personBId: tempToDbId.get(cm.person2TempId)!,
      nameA: `${p1.givenName} ${p1.surname}`,
      nameB: `${p2.givenName} ${p2.surname}`,
    });
  }

  // 17. Great-Aunt / Great-Niece (1 & 3 Gens)
  testPairs.push({
    description: 'Great-Aunt / Great-Niece (1 & 3 Gens)',
    personAId: tempToDbId.get(sibs1[0].tempId)!,
    personBId: tempToDbId.get(g3Target.tempId)!,
    nameA: `${sibs1[0].givenName} ${sibs1[0].surname}`,
    nameB: `${g3Target.givenName} ${g3Target.surname}`,
  });

  // 18. Half-branch / Mixed generation
  testPairs.push({
    description: 'Great-Great Aunt / Niece (1 & 4 Gens)',
    personAId: tempToDbId.get(sibs1[1].tempId)!,
    personBId: tempToDbId.get(g4Target.tempId)!,
    nameA: `${sibs1[1].givenName} ${sibs1[1].surname}`,
    nameB: `${g4Target.givenName} ${g4Target.surname}`,
  });

  // 19. Unrelated Person Pair 1 (Across different root lineages)
  const lineage1Person = syntheticPeople[10];
  const lineage2Person = syntheticPeople[200];
  testPairs.push({
    description: 'Unrelated Lineages 1 (No Common Ancestor)',
    personAId: tempToDbId.get(lineage1Person.tempId)!,
    personBId: tempToDbId.get(lineage2Person.tempId)!,
    nameA: `${lineage1Person.givenName} ${lineage1Person.surname}`,
    nameB: `${lineage2Person.givenName} ${lineage2Person.surname}`,
  });

  // 20. Unrelated Person Pair 2
  const lineage3Person = syntheticPeople[400];
  const lineage4Person = syntheticPeople[800];
  testPairs.push({
    description: 'Unrelated Lineages 2 (No Common Ancestor)',
    personAId: tempToDbId.get(lineage3Person.tempId)!,
    personBId: tempToDbId.get(lineage4Person.tempId)!,
    nameA: `${lineage3Person.givenName} ${lineage3Person.surname}`,
    nameB: `${lineage4Person.givenName} ${lineage4Person.surname}`,
  });

  // Ensure exactly 20 pairs
  const benchmark20 = testPairs.slice(0, 20);

  // Define the plain recursive CTE SQL query
  const runRecursiveCTEQuery = async (idA: string, idB: string) => {
    const query = sql`
      WITH RECURSIVE ancestors_a AS (
        SELECT parent_id AS ancestor_id, 1 AS generations
        FROM parent_child
        WHERE child_id = ${idA}
        UNION ALL
        SELECT pc.parent_id, a.generations + 1
        FROM parent_child pc
        JOIN ancestors_a a ON pc.child_id = a.ancestor_id
        WHERE a.generations < 10
      ),
      min_ancestors_a AS (
        SELECT ancestor_id, MIN(generations) AS generations
        FROM ancestors_a
        GROUP BY ancestor_id
      ),
      ancestors_b AS (
        SELECT parent_id AS ancestor_id, 1 AS generations
        FROM parent_child
        WHERE child_id = ${idB}
        UNION ALL
        SELECT pc.parent_id, b.generations + 1
        FROM parent_child pc
        JOIN ancestors_b b ON pc.child_id = b.ancestor_id
        WHERE b.generations < 10
      ),
      min_ancestors_b AS (
        SELECT ancestor_id, MIN(generations) AS generations
        FROM ancestors_b
        GROUP BY ancestor_id
      )
      SELECT 
        a.ancestor_id,
        a.generations AS gen_a,
        b.generations AS gen_b
      FROM min_ancestors_a a
      JOIN min_ancestors_b b ON a.ancestor_id = b.ancestor_id;
    `;
    return await db.execute(query);
  };

  // Define the ancestor closure indexed lookup SQL query
  const runAncestorClosureQuery = async (idA: string, idB: string) => {
    const query = sql`
      SELECT 
        a.ancestor_id,
        a.generations AS gen_a,
        b.generations AS gen_b
      FROM ancestor_closure a
      JOIN ancestor_closure b ON a.ancestor_id = b.ancestor_id
      WHERE a.descendant_id = ${idA} AND b.descendant_id = ${idB};
    `;
    return await db.execute(query);
  };

  // Warm-up queries (1 run)
  for (const pair of benchmark20.slice(0, 3)) {
    await runAncestorClosureQuery(pair.personAId, pair.personBId);
    await runRecursiveCTEQuery(pair.personAId, pair.personBId);
  }

  // Run benchmark across 5 iterations per query for statistically stable timings
  interface BenchmarkResult {
    index: number;
    description: string;
    personA: string;
    personB: string;
    closureTimeMs: number;
    recursiveCteTimeMs: number;
    speedup: number;
    matchCount: number;
  }

  const benchmarkResults: BenchmarkResult[] = [];
  const NUM_RUNS = 5;

  console.log('\nRunning 20 Relationship Queries across 5 iterations each...\n');

  for (let i = 0; i < benchmark20.length; i++) {
    const pair = benchmark20[i];

    // Time ancestor_closure query
    let totalClosureMs = 0;
    let matchCount = 0;
    for (let r = 0; r < NUM_RUNS; r++) {
      const t0 = performance.now();
      const res = await runAncestorClosureQuery(pair.personAId, pair.personBId);
      const t1 = performance.now();
      totalClosureMs += (t1 - t0);
      matchCount = res.rows.length;
    }
    const avgClosureMs = totalClosureMs / NUM_RUNS;

    // Time plain recursive CTE query
    let totalCteMs = 0;
    for (let r = 0; r < NUM_RUNS; r++) {
      const t0 = performance.now();
      await runRecursiveCTEQuery(pair.personAId, pair.personBId);
      const t1 = performance.now();
      totalCteMs += (t1 - t0);
    }
    const avgCteMs = totalCteMs / NUM_RUNS;

    const speedup = avgClosureMs > 0 ? avgCteMs / avgClosureMs : 1.0;

    benchmarkResults.push({
      index: i + 1,
      description: pair.description,
      personA: pair.nameA,
      personB: pair.nameB,
      closureTimeMs: avgClosureMs,
      recursiveCteTimeMs: avgCteMs,
      speedup,
      matchCount,
    });
  }

  // Calculate summary metrics
  const totalClosure = benchmarkResults.reduce((acc, r) => acc + r.closureTimeMs, 0);
  const totalCte = benchmarkResults.reduce((acc, r) => acc + r.recursiveCteTimeMs, 0);
  const avgClosure = totalClosure / benchmarkResults.length;
  const avgCte = totalCte / benchmarkResults.length;
  const overallSpeedup = totalCte / totalClosure;

  console.log('========================================================================================================');
  console.log('                 RELATIONSHIP CALCULATOR QUERY PERFORMANCE BENCHMARK (20 QUERIES)');
  console.log('========================================================================================================');
  console.log(
    '#  | Relationship Scenario                 | Closure Table (ms) | Plain Recursive CTE (ms) | Speedup Factor'
  );
  console.log('--------------------------------------------------------------------------------------------------------');
  benchmarkResults.forEach((r) => {
    const idxStr = String(r.index).padEnd(2, ' ');
    const descStr = r.description.padEnd(37, ' ');
    const closureStr = `${r.closureTimeMs.toFixed(3)} ms`.padStart(18, ' ');
    const cteStr = `${r.recursiveCteTimeMs.toFixed(3)} ms`.padStart(24, ' ');
    const speedupStr = `${r.speedup.toFixed(2)}x`.padStart(14, ' ');
    console.log(`${idxStr} | ${descStr} | ${closureStr} | ${cteStr} | ${speedupStr}`);
  });
  console.log('========================================================================================================');
  console.log(`TOTAL EXECUTION TIME (20 Queries)   : Closure = ${totalClosure.toFixed(2)} ms  |  Plain Recursive CTE = ${totalCte.toFixed(2)} ms`);
  console.log(`AVERAGE LATENCY PER QUERY           : Closure = ${avgClosure.toFixed(3)} ms  |  Plain Recursive CTE = ${avgCte.toFixed(3)} ms`);
  console.log(`OVERALL PERFORMANCE SPEEDUP RATIO   : ${overallSpeedup.toFixed(2)}x Faster with ancestor_closure table`);
  console.log('========================================================================================================\n');

  console.log('Done! All benchmarks completed successfully.');
  process.exit(0);
}

runSyntheticDatasetBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
