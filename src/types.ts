export interface DbUser {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  optedInDiscoverable: boolean;
  createdAt: string;
}

export type TreeRole = 'owner' | 'editor' | 'viewer';

export interface TreeRecord {
  treeId: string;
  name: string;
  description: string | null;
  ownerUid: string;
  isDiscoverable: boolean | null;
  createdAt: string | null;
  userRole?: TreeRole;
  personCount?: number;
  memberCount?: number;
}

export interface TreeMemberDetail {
  treeId: string;
  userUid: string;
  userEmail: string | null;
  role: TreeRole;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: string | null;
}

export type SourceType =
  | 'certificate'
  | 'oral_testimony'
  | 'photo'
  | 'external_record'
  | 'user_assertion';

export const SOURCE_TYPE_LABELS: Record<SourceType, { label: string; defaultTier: number; description: string }> = {
  certificate: {
    label: 'Certificate / Official Record',
    defaultTier: 5,
    description: 'Birth, death, or marriage certificate with state seal',
  },
  external_record: {
    label: 'External Record / Archive',
    defaultTier: 4,
    description: 'Census schedule, parish registry, or public archive',
  },
  photo: {
    label: 'Photo / Inscription',
    defaultTier: 3,
    description: 'Contemporary photograph, headstone, or heirloom inscription',
  },
  oral_testimony: {
    label: 'Oral Testimony',
    defaultTier: 2,
    description: 'Firsthand account or direct interview with relative',
  },
  user_assertion: {
    label: 'User Assertion',
    defaultTier: 1,
    description: 'Working hypothesis or personal unsourced assertion',
  },
};

export interface SourceRecord {
  sourceId: string;
  sourceType: string | null;
  citation: string;
  reliabilityTier: number | null;
}

export interface PersonClaimRecord {
  claimId: string;
  personId: string;
  attributeType: string;
  value: string;
  sourceId: string | null;
  confidence: number | null;
  submittedBy: string | null;
  submittedAt: string | null;
  status: 'active' | 'superseded' | string;
  source?: SourceRecord | null;
}

export type ParentChildRelationshipType = 'biological' | 'adoptive' | 'step' | 'foster';

export const RELATIONSHIP_TYPE_LABELS: Record<
  ParentChildRelationshipType,
  { label: string; description: string; badgeColor: string }
> = {
  biological: {
    label: 'Biological Parent',
    description: 'Direct biological lineage assertion',
    badgeColor: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40',
  },
  adoptive: {
    label: 'Adoptive Parent',
    description: 'Legal adoption record or assertion',
    badgeColor: 'bg-blue-950/70 text-blue-300 border-blue-800/40',
  },
  step: {
    label: 'Step Parent',
    description: 'Step-parent via partner or marriage',
    badgeColor: 'bg-purple-950/70 text-purple-300 border-purple-800/40',
  },
  foster: {
    label: 'Foster Parent',
    description: 'Foster care guardianship',
    badgeColor: 'bg-amber-950/70 text-amber-300 border-amber-800/40',
  },
};

export type PartnershipUnionType =
  | 'marriage'
  | 'civil_union'
  | 'domestic_partnership'
  | 'common_law'
  | 'informal';

export const UNION_TYPE_LABELS: Record<PartnershipUnionType, { label: string; description: string }> = {
  marriage: {
    label: 'Marriage',
    description: 'Legally recognized or church solemnized marriage',
  },
  civil_union: {
    label: 'Civil Union',
    description: 'Registered civil union or state partnership',
  },
  domestic_partnership: {
    label: 'Domestic Partnership',
    description: 'Formal domestic partnership agreement',
  },
  common_law: {
    label: 'Common-Law Marriage',
    description: 'Established cohabitation and mutual agreement',
  },
  informal: {
    label: 'Informal / Partner',
    description: 'Informal union or partnership',
  },
};

export interface ParentChildLinkDetail {
  parentId: string;
  childId: string;
  relationshipType: ParentChildRelationshipType | string;
  sourceId: string | null;
  confidence: number | null;
  person: PersonRecord;
  source?: SourceRecord | null;
}

export interface PartnershipDetail {
  partnershipId: string;
  person1Id: string;
  person2Id: string;
  partner: PersonRecord;
  unionType: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceId: string | null;
  source?: SourceRecord | null;
}

export interface PersonRecord {
  personId: string;
  treeId?: string | null;
  isLiving: boolean | null;
  privacyLevel: string | null;
  ancestryStatus: string | null;
  mergedInto: string | null;
  createdBy: string | null;
  createdAt: string | null;
  claims?: PersonClaimRecord[];
  parents?: ParentChildLinkDetail[];
  children?: ParentChildLinkDetail[];
  partnerships?: PartnershipDetail[];
  media?: PersonMediaRecord[];
}

export type MediaType = 'photo' | 'document' | 'certificate' | 'census_record' | 'other';

export interface PersonMediaRecord {
  mediaId: string;
  personId: string;
  title: string;
  mediaType: MediaType | string;
  mimeType: string | null;
  fileSize: number | null;
  fileUrl: string;
  sha256Checksum: string;
  description: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface AuditLogRecord {
  logId: number;
  entityType: 'person_claim' | 'parent_child' | 'partnership' | 'match_candidate' | 'person' | string;
  entityId: string;
  action: 'insert' | 'update' | 'supersede' | 'delete' | 'merge' | 'create' | string;
  oldValue: any | null;
  newValue: any | null;
  changedBy: string;
  changedAt: string;
}

export interface ParentChildRecord {
  parentId: string;
  childId: string;
  relationshipType: string;
  sourceId: string | null;
  confidence: number | null;
}

export interface PartnershipRecord {
  partnershipId: string;
  person1Id: string;
  person2Id: string;
  unionType: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceId: string | null;
}

export interface AncestorClosureRecord {
  descendantId: string;
  ancestorId: string;
  generations: number;
}

export interface AncestorDetail {
  ancestorId: string;
  generations: number;
  person: PersonRecord;
}

export interface PathPersonNode {
  personId: string;
  name: string;
  generationDistance: number; // 0 for target person, 1 for parent, 2 for grandparent...
}

export interface MRCAConnection {
  connectionId: string;
  isCouple: boolean;
  ancestor1: {
    personId: string;
    name: string;
    person: PersonRecord;
    genDistanceA: number;
    genDistanceB: number;
    pathA: PathPersonNode[];
    pathB: PathPersonNode[];
  };
  ancestor2?: {
    personId: string;
    name: string;
    person: PersonRecord;
    genDistanceA: number;
    genDistanceB: number;
    pathA: PathPersonNode[];
    pathB: PathPersonNode[];
  };
  relationshipLabel: string;
  isHalf: boolean;
  genDistanceA: number; // generation distance from Person A to MRCA
  genDistanceB: number; // generation distance from Person B to MRCA
  minGen: number;
  maxGen: number;
  removed: number;
  explanation: string;
}

export interface RelationshipResult {
  personA: PersonRecord & { displayName: string };
  personB: PersonRecord & { displayName: string };
  areIdentical: boolean;
  connections: MRCAConnection[];
  summaryMessage: string;
}

export type MatchBand = 'strong' | 'possible' | 'unlikely';
export type MatchStatus = 'pending' | 'approved' | 'rejected' | 'dismissed';

export type MatchCandidateBand = MatchBand;
export type MatchCandidateStatus = MatchStatus;

export interface MatchScoreBreakdown {
  nameSimilarity?: number;
  nameNotes?: string;
  birthProximity?: number;
  birthNotes?: string;
  birthplaceMatch?: number;
  birthplaceNotes?: string;
  familyResolution?: number;
  familyNotes?: string;
  totalScore?: number;
  nameScore?: number;
  birthScore?: number;
  placeScore?: number;
  relScore?: number;
  band?: MatchBand;
  blockingKey?: string;
}

export interface MatchCandidateRecord {
  personAId: string;
  personBId: string;
  score: number;
  band: MatchBand;
  status: MatchStatus;
  canonicalPersonId?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  breakdown: MatchScoreBreakdown | null;
  createdAt: string | null;
  personA?: PersonRecord & { displayName: string; birthDate?: string; birthPlace?: string };
  personB?: PersonRecord & { displayName: string; birthDate?: string; birthPlace?: string };
}

export type MatchCandidateWithDetails = MatchCandidateRecord;

export type ActiveView =
  | 'landing'
  | 'people'
  | 'person_detail'
  | 'duplicate_review'
  | 'trees'
  | 'relative_discovery'
  | 'audit_log'
  | 'about';



