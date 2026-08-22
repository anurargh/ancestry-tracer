import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { TreeRecord, TreeMemberDetail, TreeRole, PersonRecord } from '../types.ts';
import {
  FolderTree,
  Plus,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Edit3,
  Crown,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  Radio,
  Sparkles,
  GitBranch,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Scroll,
  Layers,
  Award,
  Key,
} from 'lucide-react';
import { motion } from 'motion/react';

interface TreesPageProps {
  onSelectTree?: (treeId: string) => void;
  selectedTreeId?: string | null;
  onSelectPerson?: (personId: string) => void;
}

export const TreesPage: React.FC<TreesPageProps> = ({
  onSelectTree,
  selectedTreeId,
  onSelectPerson,
}) => {
  const { user, getAuthHeaders } = useAuth();
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(selectedTreeId || null);
  const [activeTreeDetails, setActiveTreeDetails] = useState<{
    tree: TreeRecord;
    members: TreeMemberDetail[];
  } | null>(null);
  const [treePeople, setTreePeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOptedIn, setUserOptedIn] = useState(false);
  const [updatingConsent, setUpdatingConsent] = useState(false);

  // Modal / Form States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeDesc, setNewTreeDesc] = useState('');
  const [newTreeDiscoverable, setNewTreeDiscoverable] = useState(false);
  const [creatingTree, setCreatingTree] = useState(false);

  // Invite Member Form
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUid, setInviteUid] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TreeRole>('editor');
  const [invitingMember, setInvitingMember] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTreesAndConsent();
  }, [user]);

  useEffect(() => {
    if (activeTreeId) {
      fetchTreeDetails(activeTreeId);
    }
  }, [activeTreeId]);

  const fetchTreesAndConsent = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [treesRes, consentRes, peopleRes] = await Promise.all([
        fetch('/api/trees', { headers }),
        fetch('/api/user/consent', { headers }),
        fetch('/api/people', { headers }),
      ]);

      if (treesRes.ok) {
        const data = await treesRes.json();
        setTrees(data.trees || []);
        if (data.trees && data.trees.length > 0 && !activeTreeId) {
          setActiveTreeId(data.trees[0].treeId);
          if (onSelectTree) onSelectTree(data.trees[0].treeId);
        }
      }

      if (consentRes.ok) {
        const consentData = await consentRes.json();
        setUserOptedIn(Boolean(consentData.optedInDiscoverable));
      }

      if (peopleRes.ok) {
        const pData = await peopleRes.json();
        setTreePeople(pData.people || []);
      }
    } catch (err) {
      console.error('Failed to fetch trees or consent:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTreeDetails = async (treeId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/trees/${treeId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveTreeDetails(data);
      }
    } catch (err) {
      console.error('Failed to fetch tree details:', err);
    }
  };

  const handleToggleUserConsent = async () => {
    setUpdatingConsent(true);
    try {
      const headers = await getAuthHeaders();
      const newStatus = !userOptedIn;
      const res = await fetch('/api/user/consent', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ optedIn: newStatus }),
      });

      if (res.ok) {
        setUserOptedIn(newStatus);
        setMessage({
          type: 'success',
          text: newStatus
            ? 'Charter Updated: Living records may now be mutually discovered across authenticated archival branches.'
            : 'Charter Updated: Zero-information discovery protocol enforced. All living branches are private.',
        });
      }
    } catch (err) {
      console.error('Failed to update consent:', err);
      setMessage({ type: 'error', text: 'Failed to update discovery protocol charter.' });
    } finally {
      setUpdatingConsent(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleToggleTreeDiscoverability = async (treeId: string, currentVal: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/trees/${treeId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDiscoverable: !currentVal }),
      });

      if (res.ok) {
        await fetchTreesAndConsent();
        if (activeTreeId === treeId) {
          await fetchTreeDetails(treeId);
        }
        setMessage({
          type: 'success',
          text: !currentVal
            ? 'Sanction Granted: Repository is now indexed for cross-tree relative matching.'
            : 'Sanction Withdrawn: Repository secluded to private archive chamber.',
        });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to update repository settings.' });
      }
    } catch (err) {
      console.error('Failed to toggle tree discoverability:', err);
      setMessage({ type: 'error', text: 'Communication error updating repository charter.' });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleCreateTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreeName.trim()) return;
    setCreatingTree(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/trees', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTreeName.trim(),
          description: newTreeDesc.trim() || undefined,
          isDiscoverable: newTreeDiscoverable,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setNewTreeName('');
        setNewTreeDesc('');
        setNewTreeDiscoverable(false);
        await fetchTreesAndConsent();
        if (data.tree) {
          setActiveTreeId(data.tree.treeId);
        }
        setMessage({ type: 'success', text: `Archival repository "${newTreeName}" chartered successfully.` });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to charter repository.' });
      }
    } catch (err) {
      console.error('Failed to create tree:', err);
      setMessage({ type: 'error', text: 'Communication error chartering repository.' });
    } finally {
      setCreatingTree(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreeId || (!inviteUid.trim() && !inviteEmail.trim())) return;
    setInvitingMember(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/trees/${activeTreeId}/members`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: inviteUid.trim() || undefined,
          email: inviteEmail.trim() || undefined,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        setShowInviteModal(false);
        setInviteUid('');
        setInviteEmail('');
        await fetchTreeDetails(activeTreeId);
        setMessage({ type: 'success', text: 'Curator access credentials granted for this repository.' });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to grant curator access.' });
      }
    } catch (err) {
      console.error('Failed to invite member:', err);
      setMessage({ type: 'error', text: 'Error executing accession grant.' });
    } finally {
      setInvitingMember(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeTreeId) return;
    if (!confirm('Revoke archival access for this curator?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/trees/${activeTreeId}/members/${userId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        await fetchTreeDetails(activeTreeId);
        setMessage({ type: 'success', text: 'Curator access credentials revoked.' });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to revoke credentials.' });
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      setMessage({ type: 'error', text: 'Error revoking curator access.' });
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const activeTree = activeTreeDetails?.tree || trees.find((t) => t.treeId === activeTreeId);
  const activeTreePeople = treePeople.filter((p) => p.treeId === activeTreeId);

  return (
    <div id="trees_repository_page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      {/* Art Deco Marquee Header */}
      <div className="relative border-b-2 border-[#D4AF37]/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1813] border border-[#D4AF37]/40 text-[#D4AF37] text-[10px] font-mono uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 bg-[#D4AF37] rotate-45"></span>
              ARCHIVAL REPOSITORIES & CHARTERS • FOLIO № 200
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#F4EDE2] tracking-tight uppercase">
            Lineage Repositories & Graph Chambers
          </h1>
          <p className="text-sm font-serif text-[#C4B59D] mt-1.5 max-w-2xl leading-relaxed italic">
            Configure lineage boundaries, collaborative curatorial permissions, and cryptographic discoverability charters across multi-tenant archives.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            id="charter_new_tree_btn"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm shadow-[0_2px_12px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] transition-all border border-[#F3E5AB] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Charter New Repository</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-sm border text-xs font-serif flex items-center gap-3 ${
            message.type === 'success'
              ? 'border-[#4C7A5E]/60 bg-[#162A1F]/90 text-[#85C49F]'
              : 'border-[#9C4A3C]/60 bg-[#2A1513]/90 text-[#EBB4AC]'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#4C7A5E] shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-[#9C4A3C] shrink-0" />
          )}
          <span className="font-medium">{message.text}</span>
        </motion.div>
      )}

      {/* Global Discoverability & Zero-Leakage Privacy Chamber */}
      <div className="deco-card p-6 relative overflow-hidden bg-gradient-to-r from-[#171A1D] via-[#1A1813] to-[#171A1D] border border-[#D4AF37]/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.08),transparent_70%)] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-sm border border-[#D4AF37]/40 bg-[#120F0B] flex items-center justify-center text-[#D4AF37] shrink-0 shadow-[inset_0_0_8px_rgba(212,175,55,0.15)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">
                  CRYPTOGRAPHIC PRIVACY CHARTER
                </span>
                <span className="w-1 h-1 bg-[#D4AF37]/50 rounded-full"></span>
                <span className="text-[10px] font-mono text-[#8C8275]">ZERO INFORMATION LEAK PROTOCOL</span>
              </div>
              <h3 className="text-base font-display font-semibold text-[#F4EDE2]">
                Global Living Relative Cross-Tree Discovery Consent
              </h3>
              <p className="text-xs font-serif text-[#C4B59D] leading-relaxed max-w-3xl">
                When authorized by your signature, discoverable living individuals in your repositories may be mutually cross-referenced with other accredited genealogical researchers. If either repository maintains strict seclusion, living branches remain protected with absolute zero leakage.
              </p>
            </div>
          </div>

          <button
            id="toggle_user_consent_btn"
            onClick={handleToggleUserConsent}
            disabled={updatingConsent}
            className={`px-5 py-2.5 rounded-sm text-xs font-mono font-bold tracking-wider transition-all shrink-0 border uppercase ${
              userOptedIn
                ? 'border-[#4C7A5E] bg-[#162A1F] text-[#85C49F] hover:bg-[#1E3B2B] shadow-[0_0_12px_rgba(76,122,94,0.3)]'
                : 'border-[#D4AF37]/30 bg-[#120F0B] text-[#A69B8D] hover:text-[#F4EDE2] hover:border-[#D4AF37]/60'
            }`}
          >
            {updatingConsent
              ? 'Ratifying...'
              : userOptedIn
              ? '✓ Charter: Mutual Discovery Granted'
              : '✕ Charter: Complete Seclusion'}
          </button>
        </div>
      </div>

      {/* Main Grid: Repository Ledger & Detailed Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Repository Ledger */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-2">
            <h2 className="text-sm font-display font-bold text-[#F4EDE2] flex items-center gap-2 uppercase tracking-wider">
              <FolderTree className="w-4 h-4 text-[#D4AF37]" />
              <span>Chartered Repositories ({trees.length})</span>
            </h2>
            <span className="text-[10px] font-mono text-[#8C8275]">ACCESSION REGISTRY</span>
          </div>

          <div className="space-y-3">
            {trees.map((t) => {
              const isSelected = t.treeId === activeTreeId;
              return (
                <div
                  key={t.treeId}
                  id={`tree_item_${t.treeId}`}
                  onClick={() => {
                    setActiveTreeId(t.treeId);
                    if (onSelectTree) onSelectTree(t.treeId);
                  }}
                  className={`p-4 rounded-sm border cursor-pointer transition-all relative ${
                    isSelected
                      ? 'border-[#D4AF37] bg-gradient-to-b from-[#1C1A14] to-[#120F0B] shadow-[0_2px_15px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]/40'
                      : 'border-[#2B333C] bg-[#14181D] hover:border-[#D4AF37]/40 hover:bg-[#1A1F26]'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4AF37]"></div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="font-display font-bold text-sm text-[#F4EDE2]">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-[#8C8275] font-mono tracking-wider">
                        REGISTRY ID: {t.treeId.slice(0, 8).toUpperCase()}...
                      </div>
                    </div>
                    {t.isDiscoverable ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase border border-[#4C7A5E]/60 bg-[#162A1F] text-[#85C49F] px-2 py-0.5 rounded-sm">
                        Discoverable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase border border-[#2B333C] bg-[#101317] text-[#8C8275] px-2 py-0.5 rounded-sm">
                        Secluded
                      </span>
                    )}
                  </div>

                  {t.description && (
                    <p className="text-xs font-serif text-[#A69B8D] mt-2.5 line-clamp-2 italic leading-relaxed">
                      "{t.description}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Repository Dossier & Hand-Drafted Graph Preview */}
        <div className="lg:col-span-2 space-y-6">
          {activeTree ? (
            <div className="deco-card p-6 sm:p-8 space-y-8 bg-[#15191E] border border-[#D4AF37]/30">
              {/* Dossier Marquee Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#D4AF37]/20 pb-5">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em]">
                    ACTIVE ARCHIVE DOSSIER • VOLUME I
                  </div>
                  <h2 className="text-2xl font-display font-bold text-[#F4EDE2] tracking-tight">
                    {activeTree.name}
                  </h2>
                  <div className="text-xs font-mono text-[#A69B8D] flex flex-wrap items-center gap-3">
                    <span>Curator: {activeTree.ownerId}</span>
                    <span className="text-[#D4AF37]">✦</span>
                    <span>Chartered: {new Date(activeTree.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="toggle_tree_discoverability_btn"
                    onClick={() =>
                      handleToggleTreeDiscoverability(
                        activeTree.treeId,
                        Boolean(activeTree.isDiscoverable)
                      )
                    }
                    className={`px-3.5 py-1.5 rounded-sm text-xs font-mono font-medium border transition-all uppercase tracking-wider ${
                      activeTree.isDiscoverable
                        ? 'border-[#4C7A5E] bg-[#162A1F] text-[#85C49F]'
                        : 'border-[#2B333C] bg-[#101317] text-[#8C8275] hover:text-[#F4EDE2]'
                    }`}
                  >
                    {activeTree.isDiscoverable ? '✓ Indexed For Discovery' : 'Private Archive'}
                  </button>
                </div>
              </div>

              {/* Hand-Drafted Lineage Graph Matrix */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2B333C] pb-2">
                  <h3 className="text-xs font-display font-bold text-[#F4EDE2] flex items-center gap-2 uppercase tracking-wider">
                    <GitBranch className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Lineage Roster & Kinship Edges ({activeTreePeople.length} Records)</span>
                  </h3>
                  <span className="text-[10px] font-mono text-[#D4AF37]">
                    DIRECT DESCENDANCY MAP
                  </span>
                </div>

                {activeTreePeople.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-[#D4AF37]/20 rounded-sm text-xs font-serif text-[#8C8275] bg-[#120F0B]/40">
                    No individuals recorded in this archival repository chamber.
                  </div>
                ) : (
                  <div className="border border-[#D4AF37]/20 bg-[#101317] p-4 rounded-sm overflow-x-auto">
                    <div className="min-w-[500px] space-y-2.5">
                      {activeTreePeople.map((person, idx) => (
                        <div
                          key={person.personId}
                          id={`person_schematic_row_${person.personId}`}
                          onClick={() => onSelectPerson && onSelectPerson(person.personId)}
                          className="flex items-center gap-4 p-3 bg-[#15191E] border border-[#2B333C] hover:border-[#D4AF37] rounded-sm cursor-pointer transition-all group"
                        >
                          <div className="w-7 h-7 rounded-sm border border-[#D4AF37]/40 bg-[#120F0B] flex items-center justify-center text-[10px] font-mono text-[#D4AF37] font-bold shrink-0">
                            {idx + 1}
                          </div>

                          <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-display font-semibold text-xs text-[#F4EDE2] group-hover:text-[#D4AF37] transition-colors">
                                {person.displayName}
                              </div>
                              <div className="text-[10px] text-[#8C8275] font-mono">
                                FOLIO ID: {person.personId.slice(0, 12).toUpperCase()}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {person.isLiving ? (
                                <span className="text-[9px] font-mono text-[#85C49F] border border-[#4C7A5E]/60 bg-[#162A1F] px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                  Living Record
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono text-[#8C8275] border border-[#2B333C] bg-[#101317] px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                  Deceased
                                </span>
                              )}
                              <ArrowRight className="w-3.5 h-3.5 text-[#64707D] group-hover:text-[#D4AF37] transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Collaborative Curators & RBAC Permissions */}
              <div className="space-y-4 border-t border-[#D4AF37]/20 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-display font-bold text-[#F4EDE2] flex items-center gap-2 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Curators & Archival Privileges ({activeTreeDetails?.members?.length || 1})</span>
                  </h3>
                  <button
                    id="add_curator_btn"
                    onClick={() => setShowInviteModal(true)}
                    className="text-xs font-display font-semibold text-[#D4AF37] hover:underline flex items-center gap-1.5 tracking-wider uppercase"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Grant Curator Access</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(activeTreeDetails?.members || []).map((m) => (
                    <div
                      key={m.userId}
                      className="p-3.5 bg-[#101317] border border-[#2B333C] rounded-sm flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-display font-semibold text-[#F4EDE2]">
                          {m.displayName || m.email || m.userId}
                        </div>
                        <div className="text-[10px] text-[#8C8275] font-mono">
                          CURATOR ID: {m.userId}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-sm border border-[#D4AF37]/30 bg-[#1A1813] text-[#D4AF37] font-semibold tracking-wider">
                          {m.role}
                        </span>

                        {m.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="text-[#64707D] hover:text-[#9C4A3C] transition-colors p-1"
                            title="Revoke archival privileges"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs font-serif text-[#8C8275] border border-[#D4AF37]/20 rounded-sm bg-[#15191E]">
              Select a lineage repository from the accession ledger to inspect its charter.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Tree */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm max-w-lg w-full p-8 space-y-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-3">
              <h2 className="text-lg font-display font-bold text-[#F4EDE2] uppercase tracking-wider">
                Charter Lineage Repository
              </h2>
              <span className="text-[10px] font-mono text-[#D4AF37]">FOUNDATION PROTOCOL</span>
            </div>

            <form onSubmit={handleCreateTree} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-[#C4B59D] font-display font-medium uppercase tracking-wider text-[11px]">Repository Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Montclair Ancestral Lineage & Descendancy"
                  value={newTreeName}
                  onChange={(e) => setNewTreeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[#C4B59D] font-display font-medium uppercase tracking-wider text-[11px]">Provenance & Historical Context</label>
                <textarea
                  rows={3}
                  placeholder="Geographic scope, parish registers, ancestral regional migrations..."
                  value={newTreeDesc}
                  onChange={(e) => setNewTreeDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#120F0B] border border-[#D4AF37]/20 rounded-sm">
                <input
                  type="checkbox"
                  id="discoverable-check"
                  checked={newTreeDiscoverable}
                  onChange={(e) => setNewTreeDiscoverable(e.target.checked)}
                  className="accent-[#D4AF37] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="discoverable-check" className="text-[#F4EDE2] font-serif text-xs cursor-pointer">
                  Sanction repository for mutual cross-archive relative matching
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D4AF37]/20">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-[#A69B8D] hover:text-[#F4EDE2] font-display text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTree}
                  className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md"
                >
                  {creatingTree ? 'Chartering...' : 'Charter Repository'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal: Invite Member */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm max-w-lg w-full p-8 space-y-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-3">
              <h2 className="text-lg font-display font-bold text-[#F4EDE2] uppercase tracking-wider">
                Grant Curator Access Credentials
              </h2>
              <span className="text-[10px] font-mono text-[#D4AF37]">ACCESS ROSTER</span>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-[#C4B59D] font-display font-medium uppercase tracking-wider text-[11px]">Curator Identifier or Email</label>
                <input
                  type="text"
                  placeholder="e.g. user-sophia-chen or archivist@familygraph.internal"
                  value={inviteUid}
                  onChange={(e) => setInviteUid(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[#C4B59D] font-display font-medium uppercase tracking-wider text-[11px]">Access Privilege Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="editor">Editor — Full Claim Ingestion & Kinship Drafting Privileges</option>
                  <option value="viewer">Viewer — Read-Only Archival Inspection</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D4AF37]/20">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-[#A69B8D] hover:text-[#F4EDE2] font-display text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invitingMember}
                  className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md"
                >
                  {invitingMember ? 'Granting...' : 'Grant Access Credentials'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
