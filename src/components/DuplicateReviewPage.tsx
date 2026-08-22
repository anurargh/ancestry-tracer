import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  MatchCandidateRecord,
  MatchBand,
  MatchStatus,
  PersonRecord,
} from '../types.ts';
import {
  GitMerge,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  User,
  Calendar,
  MapPin,
  Users2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DuplicateReviewPageProps {
  onSelectPerson?: (personId: string) => void;
}

export const DuplicateReviewPage: React.FC<DuplicateReviewPageProps> = ({
  onSelectPerson,
}) => {
  const { user, getAuthHeaders } = useAuth();
  const [candidates, setCandidates] = useState<MatchCandidateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [selectedBand, setSelectedBand] = useState<string>('all'); // 'all', 'strong', 'possible', 'unlikely'
  const [selectedStatus, setSelectedStatus] = useState<string>('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected canonical person per candidate pair (key: `${personAId}_${personBId}` -> personId)
  const [canonicalSelections, setCanonicalSelections] = useState<Record<string, string>>({});

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      let url = '/api/duplicate-candidates';
      const params = new URLSearchParams();
      if (selectedBand !== 'all') params.append('band', selectedBand);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch duplicate candidates');
      }

      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err: any) {
      console.error('Error loading candidates:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load duplicate candidates' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user, selectedBand, selectedStatus]);

  const handleScanAll = async () => {
    try {
      setScanning(true);
      setFeedback(null);
      const authHeaders = await getAuthHeaders();

      const res = await fetch('/api/duplicate-candidates/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Scan failed');
      }

      const scanResult = await res.json();
      setFeedback({
        type: 'success',
        message: `Candidate scan complete: ${scanResult.scanned || 0} individuals evaluated, ${scanResult.totalCandidates || 0} potential match candidates indexed.`,
      });
      await fetchCandidates();
    } catch (err: any) {
      console.error('Error scanning duplicate candidates:', err);
      setFeedback({ type: 'error', message: err.message || 'Scan failed' });
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (candidate: MatchCandidateRecord) => {
    const pairKey = `${candidate.personAId}_${candidate.personBId}`;
    const canonicalId = canonicalSelections[pairKey] || candidate.personAId;

    try {
      setActionLoading(pairKey);
      setFeedback(null);
      const authHeaders = await getAuthHeaders();

      const res = await fetch('/api/duplicate-candidates/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          personAId: candidate.personAId,
          personBId: candidate.personBId,
          canonicalPersonId: canonicalId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve duplicate match');
      }

      setFeedback({
        type: 'success',
        message: `Successfully merged records into canonical person "${canonicalId === candidate.personAId ? candidate.personA?.displayName : candidate.personB?.displayName}". Both original identities and audit history are safely preserved.`,
      });
      await fetchCandidates();
    } catch (err: any) {
      console.error('Error approving match:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to approve duplicate match' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (candidate: MatchCandidateRecord) => {
    const pairKey = `${candidate.personAId}_${candidate.personBId}`;

    try {
      setActionLoading(pairKey);
      setFeedback(null);
      const authHeaders = await getAuthHeaders();

      const res = await fetch('/api/duplicate-candidates/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          personAId: candidate.personAId,
          personBId: candidate.personBId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reject duplicate match');
      }

      setFeedback({
        type: 'success',
        message: 'Match dismissed as distinct individuals.',
      });
      await fetchCandidates();
    } catch (err: any) {
      console.error('Error rejecting match:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to reject duplicate match' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevert = async (candidate: MatchCandidateRecord) => {
    const pairKey = `${candidate.personAId}_${candidate.personBId}`;

    try {
      setActionLoading(pairKey);
      setFeedback(null);
      const authHeaders = await getAuthHeaders();

      const res = await fetch('/api/duplicate-candidates/revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          personAId: candidate.personAId,
          personBId: candidate.personBId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to revert match decision');
      }

      setFeedback({
        type: 'success',
        message: 'Match decision successfully reverted to pending state.',
      });
      await fetchCandidates();
    } catch (err: any) {
      console.error('Error reverting match:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to revert duplicate match' });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter by search query (names)
  const filteredCandidates = candidates.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameA = c.personA?.displayName?.toLowerCase() || '';
    const nameB = c.personB?.displayName?.toLowerCase() || '';
    return nameA.includes(q) || nameB.includes(q);
  });

  const getBandBadge = (band: MatchBand) => {
    switch (band) {
      case 'strong':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Strong Match
          </span>
        );
      case 'possible':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Possible Match
          </span>
        );
      case 'unlikely':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-800 text-stone-400 border border-stone-700">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-500"></span>
            Unlikely Match
          </span>
        );
    }
  };

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Approved / Merged
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800">
            <XCircle className="w-3 h-3 text-rose-400" />
            Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-100 tracking-tight flex items-center gap-2.5">
                Duplicate Review Queue
                {candidates.length > 0 && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {candidates.filter((c) => c.status === 'pending').length} Pending
                  </span>
                )}
              </h1>
              <p className="text-xs text-stone-400 mt-0.5">
                Heuristic blocking on Soundex(surname) + birth decade with parent/spouse resolution scoring
              </p>
            </div>
          </div>
        </div>

        {/* Scan Button */}
        <div className="flex items-center gap-3">
          <button
            id="scan-duplicates-btn"
            onClick={handleScanAll}
            disabled={scanning}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning All Records...' : 'Scan for Duplicates'}</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-stone-400 hover:text-stone-200 ml-3 text-xs"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and search bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-900/80 p-3.5 rounded-2xl border border-stone-800">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'pending', label: 'Pending Review' },
            { id: 'approved', label: 'Approved (Merged)' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All Statuses' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedStatus === tab.id
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Band Filter & Search */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Band dropdown */}
          <div className="flex items-center gap-1.5 bg-stone-950 px-2.5 py-1.5 rounded-xl border border-stone-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400">Band:</span>
            <select
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
              className="bg-transparent text-stone-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="all" className="bg-stone-900">All Bands</option>
              <option value="possible" className="bg-stone-900">Possible</option>
              <option value="strong" className="bg-stone-900">Strong</option>
              <option value="unlikely" className="bg-stone-900">Unlikely</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Candidate List / Queue */}
      <div className="mt-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-stone-800 border-t-amber-400 animate-spin mx-auto"></div>
            <p className="text-stone-400 text-sm mt-4 font-mono">Evaluating candidate pairs from PostgreSQL...</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-16 text-center bg-stone-900/40 rounded-3xl border border-dashed border-stone-800 p-8">
            <div className="w-12 h-12 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-center text-stone-400 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-200 mt-4">
              {selectedStatus === 'pending' ? 'Review Queue is Clean!' : 'No match candidates found'}
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto mt-1.5">
              {selectedStatus === 'pending'
                ? 'No pending duplicate candidates match your current filter. You can click "Scan for Duplicates" to re-evaluate the full tree.'
                : 'Try adjusting your status or band filters to see historical decisions.'}
            </p>
            <button
              onClick={handleScanAll}
              disabled={scanning}
              className="mt-5 inline-flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/20 font-semibold px-4 py-2 rounded-xl text-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>Run Heuristic Duplicate Scan</span>
            </button>
          </div>
        ) : (
          filteredCandidates.map((candidate) => {
            const pairKey = `${candidate.personAId}_${candidate.personBId}`;
            const isProcessing = actionLoading === pairKey;
            const currentCanonical = canonicalSelections[pairKey] || candidate.personAId;
            const b = candidate.breakdown;

            return (
              <motion.div
                key={pairKey}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-lg relative overflow-hidden"
              >
                {/* Top Bar: Band Badge, Status, Heuristic Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
                  <div className="flex items-center gap-2.5">
                    {getBandBadge(candidate.band)}
                    {getStatusBadge(candidate.status)}
                    {b?.blockingKey && (
                      <span className="text-[11px] font-mono text-stone-400 bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                        Block: {b.blockingKey}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-stone-400 font-mono">
                      Heuristic Score:{' '}
                      <span className="text-amber-300 font-bold">{candidate.score}/100</span>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Comparison Container */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Person A Card */}
                  <div
                    className={`rounded-2xl p-4 border transition-all ${
                      currentCanonical === candidate.personAId && candidate.status === 'pending'
                        ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/30'
                        : candidate.personA?.mergedInto
                        ? 'bg-stone-950/60 border-stone-800/80 opacity-60'
                        : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-stone-800/60">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                          A
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-stone-200">
                            {candidate.personA?.displayName || 'Person A'}
                          </div>
                          <div className="text-[10px] font-mono text-stone-400">
                            ID: {candidate.personAId.slice(0, 8)}...
                          </div>
                        </div>
                      </div>

                      {onSelectPerson && (
                        <button
                          onClick={() => onSelectPerson(candidate.personAId)}
                          title="Open Person A profile"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors text-xs flex items-center gap-1"
                        >
                          <span className="text-[10px]">View</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-stone-300">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>Birth: {candidate.personA?.birthDate || 'Unspecified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-300">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">Place: {candidate.personA?.birthPlace || 'Unspecified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                        <User className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <span>{candidate.personA?.isLiving ? 'Living' : 'Deceased'} • {candidate.personA?.claims?.length || 0} claims</span>
                      </div>
                    </div>

                    {candidate.personA?.mergedInto && (
                      <div className="mt-3 py-1 px-2 rounded bg-stone-900 border border-stone-800 text-[10px] text-stone-400 font-mono">
                        Merged into: {candidate.personA.mergedInto.slice(0, 8)}... (Hidden)
                      </div>
                    )}
                  </div>

                  {/* Person B Card */}
                  <div
                    className={`rounded-2xl p-4 border transition-all ${
                      currentCanonical === candidate.personBId && candidate.status === 'pending'
                        ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/30'
                        : candidate.personB?.mergedInto
                        ? 'bg-stone-950/60 border-stone-800/80 opacity-60'
                        : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-stone-800/60">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                          B
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-stone-200">
                            {candidate.personB?.displayName || 'Person B'}
                          </div>
                          <div className="text-[10px] font-mono text-stone-400">
                            ID: {candidate.personBId.slice(0, 8)}...
                          </div>
                        </div>
                      </div>

                      {onSelectPerson && (
                        <button
                          onClick={() => onSelectPerson(candidate.personBId)}
                          title="Open Person B profile"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-cyan-300 hover:bg-stone-800 transition-colors text-xs flex items-center gap-1"
                        >
                          <span className="text-[10px]">View</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-stone-300">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>Birth: {candidate.personB?.birthDate || 'Unspecified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-300">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">Place: {candidate.personB?.birthPlace || 'Unspecified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                        <User className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <span>{candidate.personB?.isLiving ? 'Living' : 'Deceased'} • {candidate.personB?.claims?.length || 0} claims</span>
                      </div>
                    </div>

                    {candidate.personB?.mergedInto && (
                      <div className="mt-3 py-1 px-2 rounded bg-stone-900 border border-stone-800 text-[10px] text-stone-400 font-mono">
                        Merged into: {candidate.personB.mergedInto.slice(0, 8)}... (Hidden)
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed Scoring Breakdown Panel */}
                {b && (
                  <div className="mt-5 p-4 bg-stone-950/60 rounded-2xl border border-stone-800/80">
                    <div className="text-xs font-semibold text-stone-300 flex items-center justify-between pb-2 border-b border-stone-800/60">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Heuristic Factor Scoring & Evidence
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        Not a calibrated model; heuristic band evaluation
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* Name Similarity */}
                      <div className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-800">
                        <div className="flex items-center justify-between text-stone-300 font-medium">
                          <span>Fuzzy Name</span>
                          <span className="font-mono text-amber-300">{b.nameSimilarity}/30</span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1 leading-snug">{b.nameNotes}</p>
                      </div>

                      {/* Birth Proximity */}
                      <div className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-800">
                        <div className="flex items-center justify-between text-stone-300 font-medium">
                          <span>Birth Proximity</span>
                          <span className="font-mono text-amber-300">{b.birthProximity}/25</span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1 leading-snug">{b.birthNotes}</p>
                      </div>

                      {/* Birthplace */}
                      <div className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-800">
                        <div className="flex items-center justify-between text-stone-300 font-medium">
                          <span>Birthplace</span>
                          <span className="font-mono text-amber-300">{b.birthplaceMatch}/15</span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1 leading-snug">{b.birthplaceNotes}</p>
                      </div>

                      {/* Family Resolution (Weighted Highest) */}
                      <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center justify-between text-amber-200 font-medium">
                          <span>Linked Family</span>
                          <span className="font-mono text-amber-400 font-bold">{b.familyResolution}/40</span>
                        </div>
                        <p className="text-[11px] text-amber-300/80 mt-1 leading-snug">{b.familyNotes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="mt-5 pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {candidate.status === 'pending' ? (
                    <>
                      {/* Canonical Record Selector */}
                      <div className="flex items-center gap-2 text-xs text-stone-300 w-full sm:w-auto">
                        <span className="text-stone-400">Canonical Record:</span>
                        <select
                          value={currentCanonical}
                          onChange={(e) =>
                            setCanonicalSelections((prev) => ({
                              ...prev,
                              [pairKey]: e.target.value,
                            }))
                          }
                          className="bg-stone-950 text-stone-200 border border-stone-700 px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-amber-500 font-medium"
                        >
                          <option value={candidate.personAId}>
                            Keep Person A (Merge B into A)
                          </option>
                          <option value={candidate.personBId}>
                            Keep Person B (Merge A into B)
                          </option>
                        </select>
                      </div>

                      {/* Approve & Reject Actions */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => handleReject(candidate)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 bg-stone-950 hover:bg-rose-950/40 text-rose-400 border border-stone-800 hover:border-rose-800/60 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject Match</span>
                        </button>

                        <button
                          onClick={() => handleApprove(candidate)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Merge Duplicate</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-stone-400">
                        {candidate.status === 'approved' ? (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Duplicate merged into canonical record without deleting history.
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" />
                            Match marked as distinct persons.
                          </span>
                        )}
                        {candidate.reviewedBy && (
                          <span className="text-[11px] text-stone-500 block mt-0.5">
                            Reviewed by {candidate.reviewedBy} • {candidate.reviewedAt ? new Date(candidate.reviewedAt).toLocaleDateString() : ''}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleRevert(candidate)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-700 font-semibold px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3 text-stone-400" />
                        <span>Revert Decision</span>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
