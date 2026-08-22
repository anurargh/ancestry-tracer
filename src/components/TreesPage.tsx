import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { TreeRecord, TreeMemberDetail, TreeRole } from '../types.ts';
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
} from 'lucide-react';

interface TreesPageProps {
  onSelectTree?: (treeId: string) => void;
  selectedTreeId?: string | null;
}

export const TreesPage: React.FC<TreesPageProps> = ({ onSelectTree, selectedTreeId }) => {
  const { user, getAuthHeaders } = useAuth();
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(selectedTreeId || null);
  const [activeTreeDetails, setActiveTreeDetails] = useState<{
    tree: TreeRecord;
    members: TreeMemberDetail[];
  } | null>(null);
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
      const [treesRes, consentRes] = await Promise.all([
        fetch('/api/trees', { headers }),
        fetch('/api/user/consent', { headers }),
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
            ? 'Opted in to Relative Discovery: Living records can be matched mutually with other consented owners.'
            : 'Opted out of Relative Discovery: Zero information is leaked to other users.',
        });
      }
    } catch (err) {
      console.error('Failed to update consent:', err);
      setMessage({ type: 'error', text: 'Failed to update discoverability consent.' });
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
            ? 'Tree is now marked discoverable for mutual relative matching.'
            : 'Tree discoverability disabled.',
        });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to update tree.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error updating tree discoverability' });
    }
    setTimeout(() => setMessage(null), 4000);
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
          description: newTreeDesc.trim(),
          isDiscoverable: newTreeDiscoverable,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewTreeName('');
        setNewTreeDesc('');
        setNewTreeDiscoverable(false);
        setShowCreateModal(false);
        await fetchTreesAndConsent();
        setActiveTreeId(data.tree.treeId);
        if (onSelectTree) onSelectTree(data.tree.treeId);
        setMessage({ type: 'success', text: `Tree "${data.tree.name}" created successfully!` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create tree' });
    } finally {
      setCreatingTree(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreeId || !inviteUid.trim()) return;

    setInvitingMember(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/trees/${activeTreeId}/members`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userUid: inviteUid.trim(),
          userEmail: inviteEmail.trim() || undefined,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        setShowInviteModal(false);
        setInviteUid('');
        setInviteEmail('');
        await fetchTreeDetails(activeTreeId);
        setMessage({ type: 'success', text: `Role "${inviteRole}" assigned successfully!` });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to assign role' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to assign role' });
    } finally {
      setInvitingMember(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleRemoveMember = async (targetUid: string) => {
    if (!activeTreeId) return;
    if (!confirm('Are you sure you want to remove this member from the tree?')) return;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/trees/${activeTreeId}/members/${targetUid}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        await fetchTreeDetails(activeTreeId);
        setMessage({ type: 'success', text: 'Member removed from tree.' });
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to remove member' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove member' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const activeTree = trees.find((t) => t.treeId === activeTreeId) || activeTreeDetails?.tree;
  const isOwner = activeTree?.userRole === 'owner';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border shadow-md animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-200'
              : 'bg-red-950/80 border-red-800/60 text-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <div className="text-sm font-medium">{message.text}</div>
        </div>
      )}

      {/* Header & Global Privacy Banner */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <FolderTree className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-stone-100 tracking-tight">
                Trees & Role-Based Access Control
              </h1>
            </div>
            <p className="text-sm text-stone-400 max-w-2xl">
              Manage family tree partitions, assign granular roles (
              <span className="text-amber-300 font-medium">Owner</span>,{' '}
              <span className="text-blue-300 font-medium">Editor</span>,{' '}
              <span className="text-stone-300 font-medium">Viewer</span>), and configure
              zero-information-leak privacy consent.
            </p>
          </div>

          {/* Global Mutual Discovery Consent Toggle */}
          <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-4 flex items-center justify-between gap-4 max-w-md shrink-0">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  userOptedIn
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <span>Relative Discovery Consent</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      userOptedIn
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {userOptedIn ? 'OPTED IN' : 'MUTED (ZERO LEAK)'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                  {userOptedIn
                    ? 'Allows mutual discovery of living records with other opted-in tree owners.'
                    : 'Living records are strictly hidden from external searches without leakage.'}
                </p>
              </div>
            </div>

            <button
              id="toggle-consent-btn"
              onClick={handleToggleUserConsent}
              disabled={updatingConsent}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                userOptedIn
                  ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              {updatingConsent ? '...' : userOptedIn ? 'Opt Out' : 'Opt In'}
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Trees List & Selected Tree Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Trees List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-amber-400" />
              <span>Your Lineage Trees ({trees.length})</span>
            </h2>
            <button
              id="create-tree-modal-btn"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Tree</span>
            </button>
          </div>

          <div className="space-y-3">
            {trees.map((t) => {
              const isSelected = t.treeId === activeTreeId;
              return (
                <div
                  key={t.treeId}
                  onClick={() => {
                    setActiveTreeId(t.treeId);
                    if (onSelectTree) onSelectTree(t.treeId);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-800/90 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-stone-900/60 border-stone-800/80 hover:bg-stone-800/40 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-stone-100 text-sm">{t.name}</h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider flex items-center gap-1 ${
                            t.userRole === 'owner'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                              : t.userRole === 'editor'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                              : 'bg-stone-800 text-stone-300 border border-stone-700'
                          }`}
                        >
                          {t.userRole === 'owner' ? (
                            <Crown className="w-2.5 h-2.5" />
                          ) : t.userRole === 'editor' ? (
                            <Edit3 className="w-2.5 h-2.5" />
                          ) : (
                            <Eye className="w-2.5 h-2.5" />
                          )}
                          <span>{t.userRole}</span>
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 line-clamp-2">
                        {t.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-medium text-stone-300 bg-stone-950 px-2 py-1 rounded border border-stone-800">
                        {t.personCount || 0} People
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                      {t.isDiscoverable ? (
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-stone-500" />
                      )}
                      <span>{t.isDiscoverable ? 'Discoverable' : 'Private Tree'}</span>
                    </span>

                    <span className="text-stone-500 font-mono">
                      ID: {t.treeId.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Tree Settings & Members Management */}
        <div className="lg:col-span-7 space-y-6">
          {activeTree ? (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-6">
              {/* Tree Details Top Banner */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-stone-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-stone-100">{activeTree.name}</h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700">
                      Role: {activeTree.userRole}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">
                    {activeTree.description || 'Primary genealogical tree and research lineage.'}
                  </p>
                </div>

                {isOwner && (
                  <button
                    id="toggle-tree-disc-btn"
                    onClick={() =>
                      handleToggleTreeDiscoverability(activeTree.treeId, Boolean(activeTree.isDiscoverable))
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      activeTree.isDiscoverable
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {activeTree.isDiscoverable ? (
                      <>
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Discoverability: Enabled</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-stone-400" />
                        <span>Discoverability: Private</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Tree RBAC Permissions Matrix Overview */}
              <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-stone-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Tree Permission Enforcement</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 space-y-1">
                    <div className="font-semibold text-amber-300 flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      <span>Owner</span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Full control. Can add claims, edit relationships, confirm merges, and manage member roles.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 space-y-1">
                    <div className="font-semibold text-blue-300 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      <span>Editor</span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Can add sourced claims, link parent/children, add partnerships, and confirm duplicate merges.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 space-y-1">
                    <div className="font-semibold text-stone-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>Viewer</span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Read-only access. Can inspect graph and claims. Write actions and merge buttons are gated.
                    </p>
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-stone-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Tree Members & Collaborators</span>
                  </h3>

                  {isOwner && (
                    <button
                      id="invite-member-btn"
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-700 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Add / Assign Role</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-stone-800/60 border border-stone-800 rounded-xl overflow-hidden bg-stone-950/40">
                  {activeTreeDetails?.members && activeTreeDetails.members.length > 0 ? (
                    activeTreeDetails.members.map((member) => (
                      <div
                        key={member.userUid}
                        className="p-3.5 flex items-center justify-between gap-4 hover:bg-stone-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt=""
                              className="w-8 h-8 rounded-full border border-stone-700 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 font-semibold text-xs flex items-center justify-center border border-stone-700">
                              {(member.userEmail || member.userUid).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-semibold text-stone-200">
                              {member.displayName || member.userEmail || member.userUid}
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              UID: {member.userUid}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                              member.role === 'owner'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                                : member.role === 'editor'
                                ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
                                : 'bg-stone-800 text-stone-300 border border-stone-700'
                            }`}
                          >
                            {member.role === 'owner' ? (
                              <Crown className="w-3 h-3" />
                            ) : member.role === 'editor' ? (
                              <Edit3 className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            <span className="capitalize">{member.role}</span>
                          </span>

                          {isOwner && member.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(member.userUid)}
                              title="Remove member"
                              className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-stone-800 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-stone-400">
                      Loading tree members...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-12 text-center text-stone-400 space-y-3">
              <FolderTree className="w-10 h-10 mx-auto text-stone-600" />
              <p className="text-sm">Select a tree from the left column to manage settings and roles.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Tree */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-amber-400" />
                <span>Create New Family Tree</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTree} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Tree Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Miller & O'Connor Lineage"
                  value={newTreeName}
                  onChange={(e) => setNewTreeName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Description / Research Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Maternal lineage branch tracing 19th-century Irish emigrants."
                  value={newTreeDesc}
                  onChange={(e) => setNewTreeDesc(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-stone-200">
                    Enable Tree Discoverability
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Allows mutual matching of deceased records and opted-in living records.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={newTreeDiscoverable}
                  onChange={(e) => setNewTreeDiscoverable(e.target.checked)}
                  className="rounded border-stone-700 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-stone-900 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTree || !newTreeName.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition-all disabled:opacity-50"
                >
                  {creatingTree ? 'Creating...' : 'Create Tree'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite / Assign Role */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <span>Assign Tree Role</span>
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-stone-400 hover:text-stone-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  User UID <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Firebase Auth UID or user ID"
                  value={inviteUid}
                  onChange={(e) => setInviteUid(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  User Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Assigned Tree Role <span className="text-amber-400">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TreeRole)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="editor">Editor (Can add claims, link family, confirm merges)</option>
                  <option value="viewer">Viewer (Read-only access to tree records)</option>
                  <option value="owner">Owner (Full administrative rights)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invitingMember || !inviteUid.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition-all disabled:opacity-50"
                >
                  {invitingMember ? 'Saving...' : 'Assign Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
