import React, { useState, useEffect } from 'react';
import {
  PersonRecord,
  PersonClaimRecord,
  ParentChildLinkDetail,
  PartnershipDetail,
  AncestorDetail,
  SOURCE_TYPE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  UNION_TYPE_LABELS,
  ParentChildRelationshipType,
  PartnershipUnionType,
} from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  evaluatePersonClaims,
  formatAttributeLabel,
  getTierBadgeStyle,
} from '../utils/claims.ts';
import { AddClaimModal } from './AddClaimModal.tsx';
import { AddParentChildModal } from './AddParentChildModal.tsx';
import { AddPartnershipModal } from './AddPartnershipModal.tsx';
import { RelationshipCalculatorModal } from './RelationshipCalculatorModal.tsx';
import { RelativeDiscoveryModal } from './RelativeDiscoveryModal.tsx';
import { PersonMediaGallery } from './PersonMediaGallery.tsx';
import { MediaUploadModal } from './MediaUploadModal.tsx';
import {
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  Briefcase,
  ShieldCheck,
  Award,
  Layers,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  Database,
  ExternalLink,
  Tag,
  GitBranch,
  Heart,
  Users,
  Trash2,
  ArrowUpRight,
  ShieldAlert,
  GitCommit,
  Workflow,
  RefreshCw,
  Compass,
  Crown,
  Edit3,
  Eye,
  Lock,
  Globe,
  Radio,
  BookOpen,
} from 'lucide-react';

interface PersonDetailPageProps {
  person: PersonRecord;
  onBack: () => void;
  onPersonUpdated: (updated: PersonRecord) => void;
  onSelectPerson?: (personId: string) => void;
}

const CORE_ATTRIBUTES = ['name', 'birth_date', 'birth_place', 'occupation'];

export const PersonDetailPage: React.FC<PersonDetailPageProps> = ({
  person,
  onBack,
  onPersonUpdated,
  onSelectPerson,
}) => {
  const { getIdToken } = useAuth();
  const [expandedAttributes, setExpandedAttributes] = useState<Record<string, boolean>>({
    name: true,
    birth_date: true,
    birth_place: true,
    occupation: true,
  });

  // Modal states
  const [claimModalOpen, setClaimModalOpen] = useState<boolean>(false);
  const [modalInitialAttribute, setModalInitialAttribute] = useState<string>('name');
  const [supersedingClaimId, setSupersedingClaimId] = useState<string | null>(null);

  // Relationship modal states
  const [parentChildModalOpen, setParentChildModalOpen] = useState<boolean>(false);
  const [parentChildMode, setParentChildMode] = useState<'parent' | 'child'>('parent');
  const [partnershipModalOpen, setPartnershipModalOpen] = useState<boolean>(false);
  const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null);

  // Ancestor Closure State
  const [ancestors, setAncestors] = useState<AncestorDetail[]>([]);
  const [loadingAncestors, setLoadingAncestors] = useState<boolean>(false);
  const [showClosureDetails, setShowClosureDetails] = useState<boolean>(true);

  // Relationship Calculator Modal state
  const [calculatorModalOpen, setCalculatorModalOpen] = useState<boolean>(false);
  const [calcTargetPersonId, setCalcTargetPersonId] = useState<string | null>(null);

  // Relative Discovery Modal state
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState<boolean>(false);

  // Media Upload Modal state
  const [mediaUploadModalOpen, setMediaUploadModalOpen] = useState<boolean>(false);

  // Evaluate claims
  const evaluation = evaluatePersonClaims(person.claims || []);

  const allAttributeKeys = Array.from(
    new Set([...CORE_ATTRIBUTES, ...Object.keys(evaluation)])
  );

  const toggleExpand = (attr: string) => {
    setExpandedAttributes((prev) => ({
      ...prev,
      [attr]: !prev[attr],
    }));
  };

  const openAddClaimModal = (attr: string) => {
    setModalInitialAttribute(attr);
    setClaimModalOpen(true);
  };

  const fetchAncestors = async () => {
    try {
      setLoadingAncestors(true);
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/people/${person.personId}/ancestors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAncestors(data.ancestors || []);
      }
    } catch (err) {
      console.error('Failed to fetch ancestors from closure:', err);
    } finally {
      setLoadingAncestors(false);
    }
  };

  useEffect(() => {
    fetchAncestors();
  }, [person.personId]);

  const refreshPerson = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/people/${person.personId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.person) {
          onPersonUpdated(data.person);
        }
      }
      fetchAncestors();
    } catch (err) {
      console.error('Failed to refresh person record:', err);
    }
  };

  const handleUnlinkParentChild = async (
    parentId: string,
    childId: string,
    relationshipType: ParentChildRelationshipType
  ) => {
    if (
      !confirm(
        `Remove this ${relationshipType} parent-child link? Sourced provenance records will be preserved.`
      )
    )
      return;

    const key = `${parentId}-${childId}-${relationshipType}`;
    setUnlinkingKey(key);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/relationships/parent-child', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ parentId, childId, relationshipType }),
      });

      if (res.ok) {
        await refreshPerson();
      }
    } catch (err) {
      console.error('Failed to unlink parent-child:', err);
    } finally {
      setUnlinkingKey(null);
    }
  };

  const handleUnlinkPartnership = async (partnershipId: string) => {
    if (!confirm('Remove this partnership record?')) return;
    setUnlinkingKey(partnershipId);

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/relationships/partnership/${partnershipId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await refreshPerson();
      }
    } catch (err) {
      console.error('Failed to unlink partnership:', err);
    } finally {
      setUnlinkingKey(null);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshPerson();
      }
    } catch (err) {
      console.error('Failed to delete media:', err);
    }
  };

  const openLinkParent = () => {
    setParentChildMode('parent');
    setParentChildModalOpen(true);
  };

  const openLinkChild = () => {
    setParentChildMode('child');
    setParentChildModalOpen(true);
  };

  const openLinkPartner = () => {
    setPartnershipModalOpen(true);
  };

  // Determine display values
  const nameEval = evaluation['name'];
  const bestName = nameEval?.bestClaims[0]?.value || 'Unnamed Individual';

  const totalClaims = person.claims?.length || 0;
  const activeClaims = person.claims?.filter((c) => c.status === 'active').length || 0;
  const supersededClaims = person.claims?.filter((c) => c.status === 'superseded').length || 0;

  const parents = person.parents || [];
  const children = person.children || [];
  const partnerships = person.partnerships || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Archival Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#C5A059]/30 pb-5">
        <button
          id="back-to-people-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-deco font-semibold text-[#A89F91] hover:text-[#F5DE98] transition-colors py-2 px-3.5 border border-[#222B38] bg-[#0A0E15] hover:bg-[#131A24] tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>RETURN TO REGISTRY</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="discover-relatives-btn"
            onClick={() => setDiscoveryModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#0B221B] hover:bg-[#113328] text-[#52B395] border border-[#1D5C4A] font-deco font-semibold px-4 py-2 text-xs transition-all shadow-sm active:scale-95 tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#52B395]" />
            <span>DISCOVER KIN</span>
          </button>

          <button
            id="how-related-btn"
            onClick={() => {
              setCalcTargetPersonId(null);
              setCalculatorModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-[#0D1219] hover:bg-[#131A24] text-[#F5DE98] border border-[#C5A059]/40 hover:border-[#C5A059] font-deco font-semibold px-4 py-2 text-xs transition-colors tracking-wider"
          >
            <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>KINSHIP CALC</span>
          </button>

          {((person as any).canEdit ?? true) && (
            <button
              id="add-claim-main-btn"
              onClick={() => openAddClaimModal('name')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#C5A059] via-[#E2BA6E] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold tracking-wider px-4 py-2 text-xs transition-all shadow-[0_0_12px_rgba(197,160,89,0.3)] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-[#07090D]" />
              <span>ASSERT SOURCED CLAIM</span>
            </button>
          )}
        </div>
      </div>

      {/* Person Dossier Header Card */}
      <div className="border border-[#C5A059]/40 bg-[#0A0E15] p-7 sm:p-9 space-y-6 shadow-xl relative deco-corner-accent">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono border border-[#C5A059]/50 bg-[#07090D] text-[#F5DE98] font-semibold">
                DOSSIER UUID: {person.personId.slice(0, 12)}...
              </span>

              {/* RBAC Tree Role */}
              {(person as any).userRole && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-mono uppercase ${
                    (person as any).userRole === 'owner'
                      ? 'border border-[#C5A059] bg-[#0D1219] text-[#F5DE98]'
                      : 'border border-[#222B38] bg-[#07090D] text-[#A89F91]'
                  }`}
                >
                  <Crown className="w-3 h-3 text-[#C5A059]" />
                  <span>Access: {(person as any).userRole}</span>
                </span>
              )}

              {person.isLiving ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono border border-[#1D5C4A] bg-[#0B221B] text-[#52B395]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#52B395]"></span>
                  LIVING (PRIVACY PROTECTED)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono border border-[#222B38] bg-[#07090D] text-[#A89F91]">
                  DECEASED INDIVIDUAL
                </span>
              )}

              {person.ancestryStatus === 'direct_ancestor' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono border border-[#C5A059]/40 bg-[#0D1219] text-[#F5DE98]">
                  ✦ DIRECT ANCESTOR LINE
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-deco font-bold text-[#F5DE98] tracking-wide">
              {bestName}
            </h1>

            <p className="text-xs text-[#A89F91] font-mono">
              Tree Folio: {person.treeId.slice(0, 12)}... • Registered: {new Date(person.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Quick Metrics Stamped Box */}
          <div className="flex items-center gap-4 bg-[#07090D] border border-[#C5A059]/30 p-4 text-xs font-mono shadow-md">
            <div className="text-center px-3">
              <div className="text-[9px] text-[#A89F91] uppercase tracking-wider">Active</div>
              <div className="text-lg font-deco font-bold text-[#F5DE98]">{activeClaims}</div>
            </div>
            <div className="w-px h-9 bg-[#222B38]"></div>
            <div className="text-center px-3">
              <div className="text-[9px] text-[#A89F91] uppercase tracking-wider">Superseded</div>
              <div className="text-lg font-deco font-bold text-[#6E675C]">{supersededClaims}</div>
            </div>
            <div className="w-px h-9 bg-[#222B38]"></div>
            <div className="text-center px-3">
              <div className="text-[9px] text-[#A89F91] uppercase tracking-wider">Artifacts</div>
              <div className="text-lg font-deco font-bold text-[#C5A059]">{person.media?.length || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim-Centric Evidential Evaluation Ledger */}
      <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-7 space-y-6 shadow-xl deco-corner-accent">
        <div className="flex items-center justify-between border-b border-[#222B38] pb-4">
          <div>
            <h2 className="text-base font-deco font-bold text-[#F5DE98] flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-[#C5A059]" />
              <span>Evidential Claims Ledger & Competing Assertions</span>
            </h2>
            <p className="text-xs text-[#A89F91] mt-1 font-reading">
              Genealogical attributes resolved through multi-tier evidential reliability arbitration.
            </p>
          </div>
        </div>

        {/* Attribute Ledger Cards */}
        <div className="space-y-4">
          {allAttributeKeys.map((attr) => {
            const attrEval = evaluation[attr];
            const isExpanded = expandedAttributes[attr] ?? true;
            const hasClaims = attrEval && attrEval.allClaims.length > 0;
            const best = attrEval?.bestClaims[0];
            const hasConflict = attrEval?.hasTies;

            return (
              <div
                key={attr}
                className="border border-[#222B38] bg-[#07090D] overflow-hidden transition-all"
              >
                {/* Attribute Bar */}
                <div
                  onClick={() => toggleExpand(attr)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#131A24] transition-colors"
                >
                  <div className="flex items-center gap-3.5 flex-wrap">
                    <div className="text-xs font-mono font-bold uppercase text-[#C5A059] w-32 tracking-wider">
                      {formatAttributeLabel(attr)}
                    </div>

                    {hasClaims ? (
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-deco font-bold text-sm text-[#F5DE98]">
                          {best?.value}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[10px] font-mono border border-[#C5A059]/40 bg-[#0A0E15] px-2 py-0.5 text-[#F5DE98]">
                          Tier {best?.source?.reliabilityTier || 3}/5 ({SOURCE_TYPE_LABELS[(best?.source?.sourceType as any) || 'certificate']?.label || best?.source?.sourceType || 'Record'})
                        </span>

                        {attrEval.hasTies && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono border border-[#5E1D31] bg-[#240B13] text-[#D9658B] px-2 py-0.5">
                            <AlertCircle className="w-3 h-3" />
                            <span>{attrEval.activeClaims.length} Competing Claims</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-[#6E675C] italic">
                        No assertions recorded in archive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {((person as any).canEdit ?? true) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddClaimModal(attr);
                        }}
                        className="text-[11px] font-deco font-semibold text-[#C5A059] hover:underline px-2 py-1 tracking-wider"
                      >
                        + ASSERT
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#6E675C]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6E675C]" />
                    )}
                  </div>
                </div>

                {/* Expanded Claims Provenance Details */}
                {isExpanded && (
                  <div className="border-t border-[#222B38] bg-[#0A0E15] p-5 space-y-3">
                    {hasClaims ? (
                      <div className="space-y-3">
                        {attrEval.allClaims.map((claim) => {
                          const isBest = attrEval.bestClaims.some((b) => b.claimId === claim.claimId);
                          const isSuperseded = claim.status === 'superseded';

                          return (
                            <div
                              key={claim.claimId}
                              className={`p-4 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isBest
                                  ? 'border-[#1D5C4A] bg-[#0B221B]/40'
                                  : isSuperseded
                                  ? 'border-[#222B38] bg-[#07090D]/50 opacity-60'
                                  : 'border-[#222B38] bg-[#07090D]'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-deco font-bold text-sm text-[#F5DE98]">
                                    "{claim.value}"
                                  </span>
                                  {isBest && (
                                    <span className="text-[9px] font-mono uppercase bg-[#1D5C4A] text-[#52B395] px-2 py-0.5 font-bold tracking-wider">
                                      CANONICAL EVIDENCE
                                    </span>
                                  )}
                                  {isSuperseded && (
                                    <span className="text-[9px] font-mono uppercase bg-[#222B38] text-[#A89F91] px-2 py-0.5">
                                      SUPERSEDED
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-[#A89F91] space-x-2 font-reading">
                                  <span className="font-semibold text-[#E8DFD0]">
                                    Source: {SOURCE_TYPE_LABELS[(claim.source?.sourceType as any)]?.label || claim.source?.sourceType || 'Assertion'}
                                  </span>
                                  <span>•</span>
                                  <span>Citation: {claim.source?.citation || 'General Archive Entry'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right text-[11px] font-mono text-[#A89F91]">
                                  <div>Tier {claim.source?.reliabilityTier || 1}/5</div>
                                  <div>Confidence: {claim.confidence ?? 50}%</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-[#A89F91] py-2 font-reading">
                        No assertions recorded for this attribute. Click "+ ASSERT" to register historical citations.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Immediate Kinship Dossiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parents Ledger */}
        <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-6 space-y-4 shadow-md deco-corner-accent">
          <div className="flex items-center justify-between border-b border-[#222B38] pb-3">
            <h2 className="text-sm font-deco font-bold text-[#F5DE98] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C5A059]" />
              <span>Parental Lineages ({parents.length})</span>
            </h2>
            {((person as any).canEdit ?? true) && (
              <button
                id="link-parent-btn"
                onClick={openLinkParent}
                className="text-xs text-[#C5A059] hover:underline flex items-center gap-1 font-deco font-semibold tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>LINK PARENT</span>
              </button>
            )}
          </div>

          {parents.length === 0 ? (
            <div className="text-xs text-[#6E675C] py-6 text-center border border-[#222B38] bg-[#07090D] font-reading">
              No parent linkages recorded in graph.
            </div>
          ) : (
            <div className="space-y-2.5">
              {parents.map((p) => {
                const pEval = evaluatePersonClaims(p.person?.claims || []);
                const pName = pEval['name']?.bestClaims[0]?.value || 'Unnamed Parent';
                const key = `${p.parentId}-${p.childId}-${p.relationshipType}`;

                return (
                  <div
                    key={key}
                    className="p-3.5 bg-[#07090D] border border-[#222B38] flex items-center justify-between hover:border-[#C5A059]/60 transition-colors"
                  >
                    <div
                      onClick={() => onSelectPerson && onSelectPerson(p.parentId)}
                      className="cursor-pointer space-y-1"
                    >
                      <div className="font-deco font-bold text-xs text-[#F5DE98] hover:text-[#FFF0C2]">
                        {pName}
                      </div>
                      <div className="text-[10px] text-[#A89F91] font-mono">
                        {RELATIONSHIP_TYPE_LABELS[p.relationshipType as ParentChildRelationshipType]?.label || p.relationshipType} • Evidence Tier {p.source?.reliabilityTier || 4}/5
                      </div>
                    </div>

                    {((person as any).canEdit ?? true) && (
                      <button
                        onClick={() =>
                          handleUnlinkParentChild(
                            p.parentId,
                            p.childId,
                            p.relationshipType as ParentChildRelationshipType
                          )
                        }
                        disabled={unlinkingKey === key}
                        className="p-1 text-[#6E675C] hover:text-[#D9658B] transition-colors"
                        title="Unlink parent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Children Ledger */}
        <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-6 space-y-4 shadow-md deco-corner-accent">
          <div className="flex items-center justify-between border-b border-[#222B38] pb-3">
            <h2 className="text-sm font-deco font-bold text-[#F5DE98] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C5A059]" />
              <span>Descendant Children ({children.length})</span>
            </h2>
            {((person as any).canEdit ?? true) && (
              <button
                id="link-child-btn"
                onClick={openLinkChild}
                className="text-xs text-[#C5A059] hover:underline flex items-center gap-1 font-deco font-semibold tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>LINK CHILD</span>
              </button>
            )}
          </div>

          {children.length === 0 ? (
            <div className="text-xs text-[#6E675C] py-6 text-center border border-[#222B38] bg-[#07090D] font-reading">
              No descendant records registered.
            </div>
          ) : (
            <div className="space-y-2.5">
              {children.map((c) => {
                const cEval = evaluatePersonClaims(c.person?.claims || []);
                const cName = cEval['name']?.bestClaims[0]?.value || 'Unnamed Child';
                const key = `${c.parentId}-${c.childId}-${c.relationshipType}`;

                return (
                  <div
                    key={key}
                    className="p-3.5 bg-[#07090D] border border-[#222B38] flex items-center justify-between hover:border-[#C5A059]/60 transition-colors"
                  >
                    <div
                      onClick={() => onSelectPerson && onSelectPerson(c.childId)}
                      className="cursor-pointer space-y-1"
                    >
                      <div className="font-deco font-bold text-xs text-[#F5DE98] hover:text-[#FFF0C2]">
                        {cName}
                      </div>
                      <div className="text-[10px] text-[#A89F91] font-mono">
                        {RELATIONSHIP_TYPE_LABELS[c.relationshipType as ParentChildRelationshipType]?.label || c.relationshipType} • Evidence Tier {c.source?.reliabilityTier || 4}/5
                      </div>
                    </div>

                    {((person as any).canEdit ?? true) && (
                      <button
                        onClick={() =>
                          handleUnlinkParentChild(
                            c.parentId,
                            c.childId,
                            c.relationshipType as ParentChildRelationshipType
                          )
                        }
                        disabled={unlinkingKey === key}
                        className="p-1 text-[#6E675C] hover:text-[#D9658B] transition-colors"
                        title="Unlink child"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Partnerships & Unions */}
      <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-6 space-y-4 shadow-md deco-corner-accent">
        <div className="flex items-center justify-between border-b border-[#222B38] pb-3">
          <h2 className="text-sm font-deco font-bold text-[#F5DE98] flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#C5A059]" />
            <span>Spousal Unions & Partnerships ({partnerships.length})</span>
          </h2>
          {((person as any).canEdit ?? true) && (
            <button
              id="link-partner-btn"
              onClick={openLinkPartner}
              className="text-xs text-[#C5A059] hover:underline flex items-center gap-1 font-deco font-semibold tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>RECORD UNION</span>
            </button>
          )}
        </div>

        {partnerships.length === 0 ? (
          <div className="text-xs text-[#6E675C] py-6 text-center border border-[#222B38] bg-[#07090D] font-reading">
            No marriage or partnership unions registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {partnerships.map((p) => {
              const partnerEval = evaluatePersonClaims(p.partner?.claims || []);
              const partnerName = partnerEval['name']?.bestClaims[0]?.value || 'Unnamed Partner';

              return (
                <div
                  key={p.partnershipId}
                  className="p-3.5 bg-[#07090D] border border-[#222B38] flex items-center justify-between hover:border-[#C5A059]/60 transition-colors"
                >
                  <div
                    onClick={() => onSelectPerson && onSelectPerson(p.partner.personId)}
                    className="cursor-pointer space-y-1"
                  >
                    <div className="font-deco font-bold text-xs text-[#F5DE98] hover:text-[#FFF0C2]">
                      {partnerName}
                    </div>
                    <div className="text-[10px] text-[#A89F91] font-mono">
                      {UNION_TYPE_LABELS[p.unionType as PartnershipUnionType]?.label || p.unionType}
                      {p.startDate ? ` (${p.startDate})` : ''}
                    </div>
                  </div>

                  {((person as any).canEdit ?? true) && (
                    <button
                      onClick={() => handleUnlinkPartnership(p.partnershipId)}
                      disabled={unlinkingKey === p.partnershipId}
                      className="p-1 text-[#6E675C] hover:text-[#D9658B] transition-colors"
                      title="Unlink partnership"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transitive Ancestor Closure Table ($O(1)$ Reachability) */}
      <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-6 space-y-4 shadow-md deco-corner-accent">
        <div className="flex items-center justify-between border-b border-[#222B38] pb-3">
          <div>
            <h2 className="text-sm font-deco font-bold text-[#F5DE98] flex items-center gap-2">
              <Workflow className="w-4 h-4 text-[#52B395]" />
              <span>Transitive Ancestor Closure Matrix (O(1) Reachability Index)</span>
            </h2>
            <p className="text-xs text-[#A89F91] mt-1 font-reading">
              All indexed ascendants across generations, resolving cousin marriages & pedigree collapse.
            </p>
          </div>
          <button
            onClick={() => setShowClosureDetails(!showClosureDetails)}
            className="text-xs font-mono text-[#C5A059] hover:underline"
          >
            {showClosureDetails ? 'COLLAPSE' : 'EXPAND'} ({ancestors.length})
          </button>
        </div>

        {showClosureDetails && (
          loadingAncestors ? (
            <div className="py-6 text-center text-xs font-mono text-[#A89F91]">
              Computing ancestor closure matrix...
            </div>
          ) : ancestors.length === 0 ? (
            <div className="text-xs text-[#6E675C] py-6 text-center border border-[#222B38] bg-[#07090D] font-reading">
              Root progenitor (no antecedent lines linked).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {ancestors.map((anc) => {
                const aEval = evaluatePersonClaims(anc.person?.claims || []);
                const aName = aEval['name']?.bestClaims[0]?.value || `Ancestor ${anc.ancestorId.slice(0, 6)}`;
                return (
                  <div
                    key={anc.ancestorId}
                    onClick={() => onSelectPerson && onSelectPerson(anc.ancestorId)}
                    className="p-3 bg-[#07090D] border border-[#222B38] hover:border-[#C5A059] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="font-deco font-bold text-xs text-[#F5DE98]">
                        {aName}
                      </div>
                      <div className="text-[10px] text-[#6E675C] font-mono">
                        #{anc.ancestorId.slice(0, 8)}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-[#1D5C4A] bg-[#0B221B] text-[#52B395] font-bold">
                      GEN {anc.generations}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Attached Media & Archival Documents Gallery */}
      <PersonMediaGallery
        media={person.media || []}
        canEdit={(person as any).canEdit ?? true}
        onDeleteMedia={handleDeleteMedia}
        onOpenUpload={() => setMediaUploadModalOpen(true)}
      />

      {/* Modals */}
      {claimModalOpen && (
        <AddClaimModal
          isOpen={claimModalOpen}
          onClose={() => setClaimModalOpen(false)}
          person={person}
          initialAttributeType={modalInitialAttribute}
          onClaimAdded={() => refreshPerson()}
          getIdToken={getIdToken}
        />
      )}

      {parentChildModalOpen && (
        <AddParentChildModal
          isOpen={parentChildModalOpen}
          onClose={() => setParentChildModalOpen(false)}
          currentPerson={person}
          mode={parentChildMode}
          onRelationshipAdded={() => refreshPerson()}
          getIdToken={getIdToken}
        />
      )}

      {partnershipModalOpen && (
        <AddPartnershipModal
          isOpen={partnershipModalOpen}
          onClose={() => setPartnershipModalOpen(false)}
          currentPerson={person}
          onPartnershipAdded={() => refreshPerson()}
          getIdToken={getIdToken}
        />
      )}

      {calculatorModalOpen && (
        <RelationshipCalculatorModal
          isOpen={calculatorModalOpen}
          onClose={() => setCalculatorModalOpen(false)}
          initialPersonAId={person.personId}
          initialPersonBId={calcTargetPersonId}
          onSelectPerson={onSelectPerson}
        />
      )}

      {discoveryModalOpen && (
        <RelativeDiscoveryModal
          person={{ ...person, displayName: bestName }}
          onClose={() => setDiscoveryModalOpen(false)}
          onSelectRelative={(pid) => {
            setDiscoveryModalOpen(false);
            if (onSelectPerson) onSelectPerson(pid);
          }}
        />
      )}

      {mediaUploadModalOpen && (
        <MediaUploadModal
          personId={person.personId}
          personName={bestName}
          onClose={() => setMediaUploadModalOpen(false)}
          onMediaUploaded={() => refreshPerson()}
        />
      )}
    </div>
  );
};

