import { PersonClaimRecord, SourceType, SOURCE_TYPE_LABELS } from '../types.ts';

export interface AttributeEvaluation {
  attributeType: string;
  bestClaims: PersonClaimRecord[];
  hasTies: boolean;
  activeClaims: PersonClaimRecord[];
  supersededClaims: PersonClaimRecord[];
  allClaims: PersonClaimRecord[];
}

/**
 * Calculates the score of a claim based on source reliability tier (primary) and confidence (secondary)
 */
export function calculateClaimScore(claim: PersonClaimRecord): number {
  const reliabilityTier = claim.source?.reliabilityTier ?? 1;
  const confidence = claim.confidence ?? 50;
  return reliabilityTier * 1000 + confidence;
}

/**
 * Groups and evaluates all claims for a person into attribute evaluations,
 * finding the current best value (highest source reliability tier) and identifying ties as alternatives.
 */
export function evaluatePersonClaims(claims: PersonClaimRecord[] = []): Record<string, AttributeEvaluation> {
  const grouped: Record<string, PersonClaimRecord[]> = {};

  // Group by attributeType
  for (const claim of claims) {
    const attr = claim.attributeType;
    if (!grouped[attr]) {
      grouped[attr] = [];
    }
    grouped[attr].push(claim);
  }

  const result: Record<string, AttributeEvaluation> = {};

  for (const [attributeType, attrClaims] of Object.entries(grouped)) {
    const activeClaims = attrClaims.filter((c) => c.status === 'active');
    const supersededClaims = attrClaims.filter((c) => c.status === 'superseded');

    let bestClaims: PersonClaimRecord[] = [];
    let hasTies = false;

    if (activeClaims.length > 0) {
      // Find highest score among active claims
      let maxScore = -1;
      for (const c of activeClaims) {
        const score = calculateClaimScore(c);
        if (score > maxScore) {
          maxScore = score;
        }
      }

      // Collect all active claims matching the max score
      bestClaims = activeClaims.filter((c) => calculateClaimScore(c) === maxScore);
      hasTies = bestClaims.length > 1;
    }

    result[attributeType] = {
      attributeType,
      bestClaims,
      hasTies,
      activeClaims,
      supersededClaims,
      allClaims: attrClaims,
    };
  }

  return result;
}

/**
 * Formats attribute names for display (e.g., "birth_date" -> "Birth Date")
 */
export function formatAttributeLabel(attributeType: string): string {
  switch (attributeType) {
    case 'name':
      return 'Full Name';
    case 'birth_date':
      return 'Birth Date';
    case 'birth_place':
      return 'Birthplace';
    case 'occupation':
      return 'Occupation';
    case 'death_date':
      return 'Death Date';
    case 'death_place':
      return 'Place of Death';
    case 'residence':
      return 'Residence';
    case 'religion':
      return 'Religion';
    default:
      return attributeType
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

export function getTierBadgeStyle(tier: number | null | undefined): { bg: string; text: string; border: string } {
  switch (tier) {
    case 5:
      return { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-700/50' };
    case 4:
      return { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-700/50' };
    case 3:
      return { bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-700/50' };
    case 2:
      return { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-700/50' };
    default:
      return { bg: 'bg-stone-900', text: 'text-stone-400', border: 'border-stone-700' };
  }
}
