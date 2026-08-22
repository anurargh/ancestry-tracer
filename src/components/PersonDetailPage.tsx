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

  // Ancestor Closure State (reachable ancestors up to 10 generations with minimum distance)
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
        onPersonUpdated(data.person);
        await fetchAncestors();
      }
    } catch (err) {
      console.error('Failed to refresh person record:', err);
    }
  };

  const handleSupersedeClaim = async (claimId: string) => {
    if (!confirm('Mark this active claim as superseded? It will remain in historical logs.')) return;
    setSupersedingClaimId(claimId);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/claims/${claimId}/supersede`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshPerson();
      }
    } catch (err) {
      console.error('Failed to supersede claim:', err);
    } finally {
      setSupersedingClaimId(null);
    }
  };

  const handleUnlinkParentChild = async (
    parentId: string,
    childId: string,
    relationshipType: string
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

  // Determine top-level person display name
  const nameEval = evaluation['name'];
  const bestName = nameEval?.bestClaims[0]?.value || 'Unnamed Person';

  const totalClaims = person.claims?.length || 0;
  const activeClaims = person.claims?.filter((c) => c.status === 'active').length || 0;
  const supersededClaims = person.claims?.filter((c) => c.status === 'superseded').length || 0;

  const parents = person.parents || [];
  const children = person.children || [];
  const partnerships = person.partnerships || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-people-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-400 transition-colors py-1 px-2.5 rounded-lg hover:bg-stone-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to People Registry</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            id="discover-relatives-btn"
            onClick={() => setDiscoveryModalOpen(true)}
            className="inline-flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Discover Relatives</span>
          </button>

          <button
            id="how-related-btn"
            onClick={() => {
              setCalcTargetPersonId(null);
              setCalculatorModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm active:scale-95"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>How am I related to X?</span>
          </button>

          {((person as any).canEdit ?? true) && (
            <button
              id="add-claim-main-btn"
              onClick={() => openAddClaimModal('name')}
              className="inline-flex items-center gap-2 bg-stone-850 hover:bg-stone-800 text-stone-200 border border-stone-700 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Sourced Claim</span>
            </button>
          )}
        </div>
      </div>

      {/* Person Header Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <User className="w-64 h-64 text-amber-500" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  <Database className="w-3 h-3" />
                  UUID: {person.personId.slice(0, 8)}...
                </span>

                {/* RBAC Tree Role Badge */}
                {(person as any).userRole && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase font-mono ${
                      (person as any).userRole === 'owner'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                        : (person as any).userRole === 'editor'
                        ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
                        : 'bg-stone-800 text-stone-300 border border-stone-700'
                    }`}
                  >
                    {(person as any).userRole === 'owner' ? (
                      <Crown className="w-3 h-3" />
                    ) : (person as any).userRole === 'editor' ? (
                      <Edit3 className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                    <span>Tree Role: {(person as any).userRole}</span>
                  </span>
                )}

                {person.isLiving ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Living • Family Only (Protected)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-stone-300 border border-stone-700">
                    Deceased
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-800/80 text-stone-300 border border-stone-700 capitalize">
                  Privacy: {person.privacyLevel || (person.isLiving ? 'family_only' : 'public')}
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40 capitalize">
                  <GitBranch className="w-3 h-3 text-purple-400" />
                  {person.ancestryStatus?.replace(/_/g, ' ') || 'Direct Ancestor'}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-100 font-serif">
                {bestName}
              </h1>

              <p className="text-xs text-stone-400 font-mono mt-1">
                Entity ID: <code className="text-stone-300">{person.personId}</code> • Created:{' '}
                {person.createdAt ? new Date(person.createdAt).toLocaleDateString() : 'Recent'}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-center">
                <div className="text-xl font-bold font-mono text-amber-400">{totalClaims}</div>
                <div className="text-[11px] text-stone-400 uppercase tracking-wider">Claims</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-center">
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {parents.length + children.length}
                </div>
                <div className="text-[11px] text-stone-400 uppercase tracking-wider">Lineage</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-center">
                <div className="text-xl font-bold font-mono text-pink-400">{partnerships.length}</div>
                <div className="text-[11px] text-stone-400 uppercase tracking-wider">Partners</div>
              </div>
            </div>
          </div>

          {/* Sourced Model Explanation Banner */}
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-850 flex items-start gap-3 text-xs text-stone-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-stone-100">Genealogical Graph & Provenance:</strong> Sourced
              evidence asserts each entity profile and relational link. Directed parent-child edges are strictly protected by{' '}
              <strong className="text-amber-300">Topological Cycle Detection</strong> to prevent circular lineages (a person can never be their own ancestor).
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RELATIONSHIPS & FAMILY NETWORK SECTION */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-100 font-serif">
                Lineage & Family Network
              </h2>
              <p className="text-xs text-stone-400">
                Connected parent-child lineages and marital partnerships stored in PostgreSQL.
              </p>
            </div>
          </div>

          {/* Action trigger buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="link-parent-btn"
              onClick={openLinkParent}
              className="inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Parent</span>
            </button>

            <button
              id="link-child-btn"
              onClick={openLinkChild}
              className="inline-flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Child</span>
            </button>

            <button
              id="link-partner-btn"
              onClick={openLinkPartner}
              className="inline-flex items-center gap-1.5 bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/40 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Link Partner</span>
            </button>
          </div>
        </div>

        {/* 3-Column Relationship Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. PARENTS COLUMN */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 shadow-md p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                    Parents ({parents.length})
                  </span>
                </div>
                <button
                  onClick={openLinkParent}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {parents.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-stone-950/50 border border-dashed border-stone-800 text-stone-500 text-xs space-y-2">
                  <User className="w-6 h-6 mx-auto text-stone-600" />
                  <p>No parents linked yet.</p>
                  <button
                    onClick={openLinkParent}
                    className="text-amber-400 hover:underline font-mono text-[11px]"
                  >
                    + Link a parent
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {parents.map((p) => {
                    const evalP = evaluatePersonClaims(p.person?.claims || []);
                    const pName = evalP['name']?.bestClaims[0]?.value || 'Unnamed Parent';
                    const pBirth = evalP['birth_date']?.bestClaims[0]?.value;
                    const relInfo =
                      RELATIONSHIP_TYPE_LABELS[
                        p.relationshipType as ParentChildRelationshipType
                      ] || {
                        label: p.relationshipType,
                        badgeColor: 'bg-stone-800 text-stone-300 border-stone-700',
                      };
                    const tier = p.source?.reliabilityTier ?? 4;
                    const isUnlinking =
                      unlinkingKey === `${p.parentId}-${p.childId}-${p.relationshipType}`;

                    return (
                      <div
                        key={`${p.parentId}-${p.relationshipType}`}
                        className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 hover:border-stone-750 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${relInfo.badgeColor}`}
                              >
                                {relInfo.label}
                              </span>
                              <span className="text-[10px] font-mono text-stone-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                                {p.confidence ?? 90}% Conf.
                              </span>
                            </div>
                            <h4
                              onClick={() => onSelectPerson && onSelectPerson(p.parentId)}
                              className="text-sm font-bold text-stone-100 hover:text-amber-300 font-serif cursor-pointer transition-colors"
                            >
                              {pName}
                            </h4>
                            {pBirth && (
                              <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-amber-400/70" />
                                <span>Born: {pBirth}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {onSelectPerson && (
                              <button
                                onClick={() => onSelectPerson(p.parentId)}
                                title="View Profile"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-stone-850 transition-colors"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleUnlinkParentChild(p.parentId, p.childId, p.relationshipType)
                              }
                              disabled={isUnlinking}
                              title="Unlink Parent"
                              className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {p.source?.citation && (
                          <div className="text-[10px] text-stone-400 bg-stone-900/80 p-2 rounded border border-stone-850 flex items-start gap-1.5">
                            <FileText className="w-3 h-3 text-amber-400/80 shrink-0 mt-0.5" />
                            <span className="truncate">{p.source.citation}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[10px] text-stone-500 font-mono pt-2 border-t border-stone-800/60">
              Parent-Child edge stored in <code className="text-stone-400">parent_child</code>
            </div>
          </div>

          {/* 2. CHILDREN COLUMN */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 shadow-md p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Children ({children.length})
                  </span>
                </div>
                <button
                  onClick={openLinkChild}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {children.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-stone-950/50 border border-dashed border-stone-800 text-stone-500 text-xs space-y-2">
                  <Users className="w-6 h-6 mx-auto text-stone-600" />
                  <p>No children linked yet.</p>
                  <button
                    onClick={openLinkChild}
                    className="text-emerald-400 hover:underline font-mono text-[11px]"
                  >
                    + Link a child
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {children.map((c) => {
                    const evalC = evaluatePersonClaims(c.person?.claims || []);
                    const cName = evalC['name']?.bestClaims[0]?.value || 'Unnamed Child';
                    const cBirth = evalC['birth_date']?.bestClaims[0]?.value;
                    const relInfo =
                      RELATIONSHIP_TYPE_LABELS[
                        c.relationshipType as ParentChildRelationshipType
                      ] || {
                        label: c.relationshipType,
                        badgeColor: 'bg-stone-800 text-stone-300 border-stone-700',
                      };
                    const isUnlinking =
                      unlinkingKey === `${c.parentId}-${c.childId}-${c.relationshipType}`;

                    return (
                      <div
                        key={`${c.childId}-${c.relationshipType}`}
                        className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 hover:border-stone-750 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${relInfo.badgeColor}`}
                              >
                                {relInfo.label.replace(' Parent', ' Child')}
                              </span>
                              <span className="text-[10px] font-mono text-stone-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                                {c.confidence ?? 90}% Conf.
                              </span>
                            </div>
                            <h4
                              onClick={() => onSelectPerson && onSelectPerson(c.childId)}
                              className="text-sm font-bold text-stone-100 hover:text-emerald-300 font-serif cursor-pointer transition-colors"
                            >
                              {cName}
                            </h4>
                            {cBirth && (
                              <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-emerald-400/70" />
                                <span>Born: {cBirth}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {onSelectPerson && (
                              <button
                                onClick={() => onSelectPerson(c.childId)}
                                title="View Profile"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-300 hover:bg-stone-850 transition-colors"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleUnlinkParentChild(c.parentId, c.childId, c.relationshipType)
                              }
                              disabled={isUnlinking}
                              title="Unlink Child"
                              className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {c.source?.citation && (
                          <div className="text-[10px] text-stone-400 bg-stone-900/80 p-2 rounded border border-stone-850 flex items-start gap-1.5">
                            <FileText className="w-3 h-3 text-emerald-400/80 shrink-0 mt-0.5" />
                            <span className="truncate">{c.source.citation}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[10px] text-stone-500 font-mono pt-2 border-t border-stone-800/60">
              Protected by topological cycle verification
            </div>
          </div>

          {/* 3. PARTNERS / SPOUSES COLUMN */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 shadow-md p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-pink-400">
                    Spouses & Partners ({partnerships.length})
                  </span>
                </div>
                <button
                  onClick={openLinkPartner}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-mono flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {partnerships.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-stone-950/50 border border-dashed border-stone-800 text-stone-500 text-xs space-y-2">
                  <Heart className="w-6 h-6 mx-auto text-stone-600" />
                  <p>No partners or spouses recorded.</p>
                  <button
                    onClick={openLinkPartner}
                    className="text-pink-400 hover:underline font-mono text-[11px]"
                  >
                    + Link a partner
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {partnerships.map((pr) => {
                    const evalP = evaluatePersonClaims(pr.partner?.claims || []);
                    const partnerName = evalP['name']?.bestClaims[0]?.value || 'Unnamed Partner';
                    const unionKey = (pr.unionType as PartnershipUnionType) || 'marriage';
                    const unionLabel = UNION_TYPE_LABELS[unionKey]?.label || pr.unionType || 'Union';
                    const isUnlinking = unlinkingKey === pr.partnershipId;

                    return (
                      <div
                        key={pr.partnershipId}
                        className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 hover:border-stone-750 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-pink-950/70 text-pink-300 border-pink-800/40">
                                {unionLabel}
                              </span>
                              {(pr.startDate || pr.endDate) && (
                                <span className="text-[10px] font-mono text-stone-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                                  {pr.startDate || '—'} – {pr.endDate || 'present'}
                                </span>
                              )}
                            </div>
                            <h4
                              onClick={() =>
                                onSelectPerson && onSelectPerson(pr.partner.personId)
                              }
                              className="text-sm font-bold text-stone-100 hover:text-pink-300 font-serif cursor-pointer transition-colors"
                            >
                              {partnerName}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1">
                            {onSelectPerson && (
                              <button
                                onClick={() => onSelectPerson(pr.partner.personId)}
                                title="View Profile"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-pink-300 hover:bg-stone-850 transition-colors"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleUnlinkPartnership(pr.partnershipId)}
                              disabled={isUnlinking}
                              title="Remove Partnership"
                              className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {pr.source?.citation && (
                          <div className="text-[10px] text-stone-400 bg-stone-900/80 p-2 rounded border border-stone-850 flex items-start gap-1.5">
                            <FileText className="w-3 h-3 text-pink-400/80 shrink-0 mt-0.5" />
                            <span className="truncate">{pr.source.citation}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[10px] text-stone-500 font-mono pt-2 border-t border-stone-800/60">
              Partnership links stored in <code className="text-stone-400">partnership</code>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ANCESTOR CLOSURE (DAG REACHABILITY UP TO 10 GENERATIONS) */}
        {/* ========================================================================= */}
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-100 font-serif">
                    Ancestor Closure & Lineage Reachability
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                    ancestor_closure
                  </span>
                </div>
                <p className="text-xs text-stone-400">
                  Transitive ancestors reachable up to 10 generations with minimum generation counts (incrementally computed upon edge additions/removals)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchAncestors}
                disabled={loadingAncestors}
                title="Refresh Ancestor Closure"
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-stone-800 text-stone-300 hover:bg-stone-750 border border-stone-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAncestors ? 'animate-spin' : ''}`} />
                <span>Refresh Closure</span>
              </button>
              <button
                onClick={() => setShowClosureDetails(!showClosureDetails)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              >
                {showClosureDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showClosureDetails && (
            <div className="space-y-4">
              {loadingAncestors ? (
                <div className="py-6 text-center text-xs text-stone-400 font-mono flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  Loading ancestor closure records...
                </div>
              ) : ancestors.length === 0 ? (
                <div className="py-6 px-4 text-center rounded-xl bg-stone-950/60 border border-dashed border-stone-800 space-y-1">
                  <p className="text-xs text-stone-400">
                    No ancestors reachable in the current lineage graph.
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Add parent edges above to establish transitive ancestor closure.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group ancestors by generation */}
                  {Array.from(new Set<number>(ancestors.map((a) => a.generations)))
                    .sort((a: number, b: number) => a - b)
                    .map((gen: number) => {
                      const ancestorsInGen = ancestors.filter((a) => a.generations === gen);
                      let genLabel = `${gen} Generation${gen > 1 ? 's' : ''} Away`;
                      if (gen === 1) genLabel = '1st Generation (Parents)';
                      else if (gen === 2) genLabel = '2nd Generation (Grandparents)';
                      else if (gen === 3) genLabel = '3rd Generation (Great-Grandparents)';
                      else if (gen === 4) genLabel = '4th Generation (2nd Great-Grandparents)';
                      else if (gen === 5) genLabel = '5th Generation (3rd Great-Grandparents)';

                      return (
                        <div key={gen} className="rounded-xl bg-stone-950/70 border border-stone-850 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50 flex items-center justify-center text-[10px] font-bold font-mono">
                                G{gen}
                              </span>
                              <span className="text-xs font-semibold text-stone-200">
                                {genLabel}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-stone-400">
                              {ancestorsInGen.length} ancestor{ancestorsInGen.length > 1 ? 's' : ''} (min dist = {gen})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {ancestorsInGen.map((anc) => {
                              const ancEval = evaluatePersonClaims(anc.person.claims || []);
                              const nameClaim = ancEval.name?.bestClaims[0]?.value;
                              const birthClaim = ancEval.birth_date?.bestClaims[0]?.value;
                              const ancName = nameClaim || `Person (${anc.ancestorId.slice(0, 8)})`;

                              return (
                                <div
                                  key={anc.ancestorId}
                                  className="p-3 rounded-lg bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 transition-all flex items-start justify-between gap-2 group"
                                >
                                  <div className="min-w-0 flex-1">
                                    <h4
                                      onClick={() => onSelectPerson && onSelectPerson(anc.ancestorId)}
                                      className="text-xs font-bold text-stone-100 group-hover:text-amber-300 font-serif cursor-pointer truncate transition-colors"
                                    >
                                      {ancName}
                                    </h4>
                                    {birthClaim && (
                                      <p className="text-[10px] text-stone-400 font-mono mt-0.5 truncate">
                                        b. {birthClaim}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-stone-950 text-stone-400 border border-stone-800">
                                        min {anc.generations} gen
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setCalcTargetPersonId(anc.ancestorId);
                                        setCalculatorModalOpen(true);
                                      }}
                                      title="Calculate Kinship / Relationship Path"
                                      className="p-1 rounded text-stone-500 hover:text-amber-300 hover:bg-stone-800 transition-colors"
                                    >
                                      <Compass className="w-3.5 h-3.5" />
                                    </button>
                                    {onSelectPerson && (
                                      <button
                                        onClick={() => onSelectPerson(anc.ancestorId)}
                                        title="Open Ancestor Profile"
                                        className="p-1 rounded text-stone-500 hover:text-amber-300 hover:bg-stone-800 transition-colors"
                                      >
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="text-[10px] text-stone-400 font-mono pt-1 flex items-center justify-between border-t border-stone-800/60">
                <span>Composite PK on (descendant_id, ancestor_id)</span>
                <span>Max Depth: 10 Generations (Shortest Path Kept)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SOURCED ATTRIBUTES GRID */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-stone-100 font-serif">
              Sourced Profile Attributes & Evidence
            </h2>
          </div>
          <span className="text-xs text-stone-400 font-mono">
            {allAttributeKeys.length} attribute domains tracked
          </span>
        </div>

        <div className="space-y-5">
          {allAttributeKeys.map((attrKey) => {
            const attrEval = evaluation[attrKey];
            const isExpanded = expandedAttributes[attrKey] ?? false;
            const hasActiveClaims = attrEval && attrEval.activeClaims.length > 0;
            const bestClaims = attrEval?.bestClaims || [];
            const hasTies = attrEval?.hasTies || false;
            const allClaimsForAttr = attrEval?.allClaims || [];

            let AttrIcon = Tag;
            if (attrKey === 'name') AttrIcon = User;
            else if (attrKey === 'birth_date') AttrIcon = Calendar;
            else if (attrKey === 'birth_place') AttrIcon = MapPin;
            else if (attrKey === 'occupation') AttrIcon = Briefcase;

            return (
              <div
                key={attrKey}
                className="rounded-2xl bg-stone-900 border border-stone-800/80 shadow-md overflow-hidden transition-all"
              >
                {/* Attribute Main Row */}
                <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                        <AttrIcon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 font-mono">
                        {formatAttributeLabel(attrKey)} ({attrKey})
                      </span>

                      {hasTies && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Tied Alternatives ({bestClaims.length})
                        </span>
                      )}

                      {allClaimsForAttr.length > 0 && (
                        <span className="text-[11px] font-mono text-stone-500">
                          • {allClaimsForAttr.length} total assertion{allClaimsForAttr.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Best Value Display */}
                    {hasActiveClaims ? (
                      <div className="space-y-3 pt-1">
                        {bestClaims.map((claim, idx) => {
                          const tier = claim.source?.reliabilityTier ?? 1;
                          const tierStyle = getTierBadgeStyle(tier);
                          const sourceKey = claim.source?.sourceType as keyof typeof SOURCE_TYPE_LABELS;
                          const sourceLabel =
                            SOURCE_TYPE_LABELS[sourceKey]?.label ||
                            claim.source?.sourceType ||
                            'Source Citation';

                          return (
                            <div
                              key={claim.claimId}
                              className={`p-4 rounded-xl bg-stone-950 border ${
                                hasTies
                                  ? 'border-amber-500/40 shadow-sm shadow-amber-500/5'
                                  : 'border-stone-850'
                              } space-y-3`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="text-lg sm:text-xl font-bold text-stone-100 font-serif">
                                    {claim.value}
                                  </div>
                                  {hasTies && (
                                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                                      Option #{idx + 1}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
                                  >
                                    Tier {tier} • {sourceLabel}
                                  </span>

                                  <span className="text-xs font-mono text-stone-300 bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
                                    {claim.confidence ?? 50}% Conf.
                                  </span>
                                </div>
                              </div>

                              {/* Source Citation */}
                              <div className="text-xs text-stone-300 bg-stone-900/90 p-3 rounded-lg border border-stone-800/80 flex items-start gap-2.5">
                                <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                  <div className="font-mono text-[11px] text-amber-300/90 font-medium">
                                    Citation:
                                  </div>
                                  <div className="text-stone-300 leading-relaxed font-sans">
                                    {claim.source?.citation || 'No explicit citation recorded.'}
                                  </div>
                                  <div className="text-[10px] text-stone-500 font-mono pt-1">
                                    Submitted by: {claim.submittedBy || 'user'} • ID:{' '}
                                    {claim.claimId.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-stone-950/40 border border-dashed border-stone-800 text-stone-500 text-sm">
                        No active claim recorded for {formatAttributeLabel(attrKey).toLowerCase()}.
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2 shrink-0 pt-2 lg:pt-0">
                    <button
                      id={`add-claim-${attrKey}-btn`}
                      onClick={() => openAddClaimModal(attrKey)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Replace / Add Claim</span>
                    </button>

                    {allClaimsForAttr.length > 0 && (
                      <button
                        id={`toggle-history-${attrKey}-btn`}
                        onClick={() => toggleExpand(attrKey)}
                        className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-2 rounded-xl hover:bg-stone-800/50 transition-colors"
                      >
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {isExpanded ? 'Hide History' : `All Claims (${allClaimsForAttr.length})`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Claims Drawer */}
                {isExpanded && allClaimsForAttr.length > 0 && (
                  <div className="border-t border-stone-800/80 bg-stone-950/80 p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>Complete Assertion History for {formatAttributeLabel(attrKey)}</span>
                      </div>
                      <span className="text-[11px] text-stone-500 font-mono">
                        Rule: Claims are immutable; replacements mark prior as superseded
                      </span>
                    </div>

                    <div className="space-y-3">
                      {allClaimsForAttr.map((c) => {
                        const isSuperseded = c.status === 'superseded';
                        const tier = c.source?.reliabilityTier ?? 1;
                        const tierStyle = getTierBadgeStyle(tier);
                        const isCurrentlyBest = bestClaims.some((b) => b.claimId === c.claimId);

                        return (
                          <div
                            key={c.claimId}
                            className={`p-4 rounded-xl border transition-all ${
                              isSuperseded
                                ? 'bg-stone-900/40 border-stone-800/50 opacity-70'
                                : isCurrentlyBest
                                ? 'bg-stone-900 border-amber-500/30'
                                : 'bg-stone-900 border-stone-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm font-semibold ${
                                    isSuperseded ? 'text-stone-400 line-through' : 'text-stone-100'
                                  }`}
                                >
                                  "{c.value}"
                                </span>

                                {isSuperseded ? (
                                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700">
                                    Superseded
                                  </span>
                                ) : isCurrentlyBest ? (
                                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Active Best
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                                    Active Alternative
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
                                >
                                  Tier {tier} ({c.source?.sourceType || 'source'})
                                </span>

                                <span className="text-[11px] font-mono text-stone-400">
                                  {c.confidence}% conf.
                                </span>

                                {!isSuperseded && (
                                  <button
                                    id={`supersede-claim-${c.claimId}`}
                                    onClick={() => handleSupersedeClaim(c.claimId)}
                                    disabled={supersedingClaimId === c.claimId}
                                    title="Mark as superseded"
                                    className="text-[11px] text-stone-400 hover:text-amber-400 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-750 transition-colors ml-1"
                                  >
                                    {supersedingClaimId === c.claimId ? 'Updating...' : 'Supersede'}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="text-xs text-stone-400 font-mono flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-stone-800/60">
                              <span>
                                Citation: <span className="text-stone-300 font-sans">{c.source?.citation}</span>
                              </span>
                              <span>
                                Submitted: {c.submittedAt ? new Date(c.submittedAt).toLocaleString() : 'N/A'}
                              </span>
                              <span>By: {c.submittedBy || 'user'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Media & Archival Documents Gallery */}
      <div className="p-6 sm:p-8 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-6">
        <PersonMediaGallery
          media={person.media || []}
          canEdit={(person as any).canEdit ?? true}
          onDeleteMedia={handleDeleteMedia}
          onOpenUpload={() => setMediaUploadModalOpen(true)}
        />
      </div>

      {/* Sourced Schema Info Box */}
      <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 text-xs text-stone-400 space-y-3">
        <div className="flex items-center gap-2 text-stone-200 font-semibold uppercase tracking-wider">
          <Database className="w-4 h-4 text-amber-400" />
          <span>PostgreSQL Graph & Relational Integrity</span>
        </div>
        <p className="leading-relaxed">
          Attributes are stored in <code className="text-amber-300 font-mono">person_claim</code>, parent-child links in <code className="text-amber-300 font-mono">parent_child</code>, partner unions in <code className="text-amber-300 font-mono">partnership</code>, and media documents in <code className="text-amber-300 font-mono">person_media</code> with SHA-256 cryptographic provenance.
        </p>
      </div>

      {/* Add / Replace Claim Modal */}
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

      {/* Media Upload Modal */}
      {mediaUploadModalOpen && (
        <MediaUploadModal
          personId={person.personId}
          personName={bestName}
          onClose={() => setMediaUploadModalOpen(false)}
          onMediaUploaded={() => refreshPerson()}
        />
      )}

      {/* Add Parent / Child Modal with Cycle Detection */}
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

      {/* Add Partnership Modal */}
      {partnershipModalOpen && (
        <AddPartnershipModal
          isOpen={partnershipModalOpen}
          onClose={() => setPartnershipModalOpen(false)}
          currentPerson={person}
          onPartnershipAdded={() => refreshPerson()}
          getIdToken={getIdToken}
        />
      )}

      {/* Relationship Calculator Modal ("How am I related to X?") */}
      {calculatorModalOpen && (
        <RelationshipCalculatorModal
          isOpen={calculatorModalOpen}
          onClose={() => setCalculatorModalOpen(false)}
          initialPersonAId={person.personId}
          initialPersonBId={calcTargetPersonId}
          onSelectPerson={(targetId) => {
            if (onSelectPerson) {
              setCalculatorModalOpen(false);
              onSelectPerson(targetId);
            }
          }}
        />
      )}

      {/* Relative Discovery Modal */}
      {discoveryModalOpen && (
        <RelativeDiscoveryModal
          person={{
            ...person,
            displayName: bestName,
          }}
          onClose={() => setDiscoveryModalOpen(false)}
          onSelectRelative={(relId) => {
            setDiscoveryModalOpen(false);
            if (onSelectPerson) onSelectPerson(relId);
          }}
        />
      )}
    </div>
  );
};
