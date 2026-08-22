import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { MatchCandidateWithDetails, MatchCandidateBand, MatchCandidateStatus } from '../types.ts';
import { evaluatePersonClaims } from '../utils/claims.ts';
import {
  GitMerge,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  Briefcase,
  Users,
  ExternalLink,
  ChevronRight,
  Layers,
  FileText,
  RotateCcw,
  Check,
  Scroll,
  Binary,
  Compass,
} from 'lucide-react';
import { motion } from 'motion/react';

interface DuplicateReviewPageProps {
  onSelectPerson?: (personId: string) => void;
}

export const DuplicateReviewPage: React.FC<DuplicateReviewPageProps> = ({ onSelectPerson }) => {
  const { user, getAuthHeaders } = useAuth();
  const [candidates, setCandidates] = useState<MatchCandidateWithDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedBand, setSelectedBand] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tracks canonical target selection per candidate pair
  const [canonicalSelections, setCanonicalSelections] = useState<Record<string, string>>({});

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/duplicates/candidates', { headers });
      if (!res.ok) throw new Error('Failed to fetch duplicate candidates');
      const data = await res.json();
      setCandidates(data.candidates || []);

      // Pre-seed canonical selection to personAId
      const initialMap: Record<string, string> = {};
      (data.candidates || []).forEach((c: MatchCandidateWithDetails) => {
        initialMap[`${c.personAId}_${c.personBId}`] = c.canonicalPersonId || c.personAId;
      });
      setCanonicalSelections(initialMap);
    } catch (err: any) {
      console.error('Error loading duplicate candidates:', err);
      setError(err.message || 'Failed to load duplicate candidate dossiers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [user]);

  const handleScanAll = async () => {
    try {
      setScanning(true);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/duplicates/scan', {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to execute phonetic duplicate scan');
      const data = await res.json();
      const count = data.totalPairsEvaluated ?? data.scanned ?? 0;
      setSuccessMessage(`Heuristic Scan Complete: Evaluated ${count} candidate identity pairs with Soundex blocking & composite similarity.`);
      await fetchCandidates();
    } catch (err: any) {
      console.error('Error scanning duplicates:', err);
      setError(err.message || 'Failed to execute cross-repository duplicate scan');
    } finally {
      setScanning(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleApprove = async (candidate: MatchCandidateWithDetails) => {
    const pairKey = `${candidate.personAId}_${candidate.personBId}`;
    const canonicalPersonId = canonicalSelections[pairKey] || candidate.personAId;
    try {
      setActionLoading(pairKey);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/duplicates/approve`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personAId: candidate.personAId,
          personBId: candidate.personBId,
          canonicalPersonId,
        }),
      });
      if (!res.ok) throw new Error('Failed to approve duplicate match');
      const data = await res.json();
      setSuccessMessage(
        `Reconciliation Sealed: Secondary record marked merged_into canonical non-destructively.`
      );
      await fetchCandidates();
    } catch (err: any) {
      console.error('Error approving match:', err);
      setError(err.message || 'Failed to approve duplicate match');
    } finally {
      setActionLoading(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleDismiss = async (candidate: MatchCandidateWithDetails) => {
    const pairKey = `${candidate.personAId}_${candidate.personBId}`;
    try {
      setActionLoading(pairKey);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/duplicates/dismiss`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personAId: candidate.personAId,
          personBId: candidate.personBId,
        }),
      });
      if (!res.ok) throw new Error('Failed to dismiss candidate match');
      await fetchCandidates();
      setSuccessMessage('Match candidate dismissed to non-matching registry.');
    } catch (err: any) {
      console.error('Error dismissing match:', err);
      setError(err.message || 'Failed to dismiss candidate match');
    } finally {
      setActionLoading(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleUnmerge = async (candidate: MatchCandidateWithDetails) => {
    const pairKey = `${candidate.personAId}_${candidate.personBId}`;
    try {
      setActionLoading(pairKey);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/duplicates/unmerge`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personAId: candidate.personAId,
          personBId: candidate.personBId,
        }),
      });
      if (!res.ok) throw new Error('Failed to unmerge duplicate record');
      await fetchCandidates();
      setSuccessMessage('Reversion Complete: Secondary record independence restored with historical audit trail intact.');
    } catch (err: any) {
      console.error('Error unmerging:', err);
      setError(err.message || 'Failed to unmerge duplicate record');
    } finally {
      setActionLoading(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    if (selectedBand !== 'all' && c.band !== selectedBand) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameA = (c.personA?.displayName || '').toLowerCase();
      const nameB = (c.personB?.displayName || '').toLowerCase();
      return nameA.includes(q) || nameB.includes(q);
    }
    return true;
  });

  const getBandBadge = (band: MatchCandidateBand) => {
    switch (band) {
      case 'strong':
        return (
          <span className="text-[10px] font-mono uppercase bg-[#162A1F] text-[#85C49F] border border-[#4C7A5E] px-2.5 py-0.5 rounded-sm font-semibold tracking-wider">
            ★ Strong Confidence (≥80)
          </span>
        );
      case 'possible':
        return (
          <span className="text-[10px] font-mono uppercase bg-[#1A1813] text-[#D4AF37] border border-[#D4AF37]/50 px-2.5 py-0.5 rounded-sm font-semibold tracking-wider">
            ◈ Plausible Match (50–79)
          </span>
        );
      case 'unlikely':
      default:
        return (
          <span className="text-[10px] font-mono uppercase bg-[#14181D] text-[#8C8275] border border-[#2B333C] px-2.5 py-0.5 rounded-sm tracking-wider">
            ○ Marginal (&lt;50)
          </span>
        );
    }
  };

  const getStatusBadge = (status: MatchCandidateStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="text-[10px] font-mono uppercase text-[#85C49F] border border-[#4C7A5E]/60 bg-[#162A1F] px-2.5 py-0.5 rounded-sm font-medium tracking-wider">
            ✓ Reconciled & Merged
          </span>
        );
      case 'dismissed':
        return (
          <span className="text-[10px] font-mono uppercase text-[#8C8275] border border-[#2B333C] bg-[#101317] px-2.5 py-0.5 rounded-sm tracking-wider">
            ✕ Dismissed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="text-[10px] font-mono uppercase text-[#D4AF37] border border-[#D4AF37]/60 bg-[#1A1813] px-2.5 py-0.5 rounded-sm font-medium tracking-wider">
            ● Awaiting Curatorial Review
          </span>
        );
    }
  };

  const pendingCount = candidates.filter((c) => c.status === 'pending').length;
  const approvedCount = candidates.filter((c) => c.status === 'approved').length;
  const dismissedCount = candidates.filter((c) => c.status === 'dismissed').length;

  return (
    <div id="duplicate_review_page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      {/* Art Deco Marquee Header */}
      <div className="relative border-b-2 border-[#D4AF37]/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1813] border border-[#D4AF37]/40 text-[#D4AF37] text-[10px] font-mono uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 bg-[#D4AF37] rotate-45"></span>
              CROSS-RECORD RECONCILIATION & MERGE • FOLIO № 300
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#F4EDE2] tracking-tight uppercase">
            Duplicate Identity Resolution Chamber
          </h1>
          <p className="text-sm font-serif text-[#C4B59D] mt-1.5 max-w-2xl leading-relaxed italic">
            Side-by-side comparative ledger analyzing conflicting genealogical assertions, phonetic Soundex candidate blocking, and non-destructive canonical unifications.
          </p>
        </div>

        <button
          id="run_duplicate_scan_btn"
          onClick={handleScanAll}
          disabled={scanning}
          className="inline-flex items-center gap-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm shadow-[0_2px_12px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] transition-all border border-[#F3E5AB] active:scale-95 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Computing Soundex Blocks...' : 'Execute Heuristic Scan'}</span>
        </button>
      </div>

      {/* Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-sm border border-[#9C4A3C]/60 bg-[#2A1513]/90 text-[#EBB4AC] text-xs font-serif flex items-center gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-[#9C4A3C] shrink-0" />
          <span className="font-medium">{error}</span>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-sm border border-[#4C7A5E]/60 bg-[#162A1F]/90 text-[#85C49F] text-xs font-serif flex items-center gap-3"
        >
          <CheckCircle2 className="w-4 h-4 text-[#4C7A5E] shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </motion.div>
      )}

      {/* Filter and Queue Ledger Bar */}
      <div className="deco-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] border border-[#D4AF37]/30">
        {/* Status Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-[#101317] p-1 rounded-sm border border-[#2B333C]">
          {[
            { id: 'pending', label: `Pending Queue (${pendingCount})` },
            { id: 'approved', label: `Reconciled (${approvedCount})` },
            { id: 'dismissed', label: `Dismissed (${dismissedCount})` },
            { id: 'all', label: `All Pairs (${candidates.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`tab_status_${tab.id}`}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-sm text-xs font-display font-semibold uppercase tracking-wider transition-all ${
                selectedStatus === tab.id
                  ? 'bg-gradient-to-b from-[#1C1A14] to-[#120F0B] text-[#D4AF37] border-b-2 border-[#D4AF37] shadow-sm'
                  : 'text-[#8C8275] hover:text-[#F4EDE2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Band & Search Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-[#101317] border border-[#D4AF37]/30 px-3 py-1.5 rounded-sm">
            <span className="text-[#8C8275] font-mono uppercase text-[10px]">Confidence:</span>
            <select
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
              className="bg-transparent text-[#F4EDE2] font-mono text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="bg-[#15191E]">All Confidence Bands</option>
              <option value="strong" className="bg-[#15191E]">Strong Match (≥80)</option>
              <option value="possible" className="bg-[#15191E]">Plausible Match (50–79)</option>
              <option value="unlikely" className="bg-[#15191E]">Marginal (&lt;50)</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8C8275] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-1.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-xs text-[#F4EDE2] placeholder:text-[#64707D] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>
      </div>

      {/* Candidate Dossiers Queue */}
      <div className="space-y-8">
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 rounded-sm border-2 border-[#D4AF37]/30 border-t-[#D4AF37] animate-spin mx-auto"></div>
            <p className="text-xs font-mono text-[#C4B59D] uppercase tracking-widest">
              Synthesizing candidate pair dossiers from PostgreSQL database...
            </p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-[#D4AF37]/20 rounded-sm p-8 bg-[#15191E]/60 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#120F0B] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mx-auto">
              <CheckCircle2 className="w-6 h-6 text-[#4C7A5E]" />
            </div>
            <h3 className="text-lg font-display font-semibold text-[#F4EDE2] uppercase tracking-wider">
              {selectedStatus === 'pending' ? 'Curatorial Queue is Clear' : 'No Candidate Dossiers Found'}
            </h3>
            <p className="text-xs font-serif text-[#A69B8D] max-w-md mx-auto leading-relaxed italic">
              {selectedStatus === 'pending'
                ? 'All potential duplicate identity records have been evaluated. Run a heuristic scan to re-examine all lineages with updated blocking algorithms.'
                : 'Try adjusting your status or confidence band filters to reveal archived dossiers.'}
            </p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => {
            const pairKey = `${candidate.personAId}_${candidate.personBId}`;
            const isProcessing = actionLoading === pairKey;
            const currentCanonical = canonicalSelections[pairKey] || candidate.personAId;
            const b = candidate.breakdown;

            const evalA = evaluatePersonClaims(candidate.personA?.claims || []);
            const evalB = evaluatePersonClaims(candidate.personB?.claims || []);

            const birthA = evalA['birth_date']?.bestClaims[0]?.value || '—';
            const birthB = evalB['birth_date']?.bestClaims[0]?.value || '—';
            const placeA = evalA['birth_place']?.bestClaims[0]?.value || '—';
            const placeB = evalB['birth_place']?.bestClaims[0]?.value || '—';
            const occA = evalA['occupation']?.bestClaims[0]?.value || '—';
            const occB = evalB['occupation']?.bestClaims[0]?.value || '—';

            return (
              <div
                key={pairKey}
                id={`candidate_pair_${pairKey}`}
                className="deco-card p-6 sm:p-8 space-y-6 bg-[#15191E] border-2 border-[#D4AF37]/30 relative overflow-hidden shadow-lg"
              >
                {/* Dossier Header: Band, Status, Score */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D4AF37]/20 pb-5">
                  <div className="flex flex-wrap items-center gap-3">
                    {getBandBadge(candidate.band)}
                    {getStatusBadge(candidate.status)}
                    {b?.blockingKey && (
                      <span className="text-[10px] font-mono text-[#C4B59D] bg-[#101317] px-2.5 py-0.5 rounded-sm border border-[#2B333C] uppercase tracking-wider">
                        Soundex Block: <strong className="text-[#D4AF37]">{b.blockingKey}</strong>
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono text-[#A69B8D]">
                      Composite Heuristic Similarity:{' '}
                      <span className="text-[#D4AF37] font-bold text-sm">{candidate.score}/100</span>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Dual Document Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Document Record A */}
                  <div
                    className={`border-2 rounded-sm p-5 space-y-4 transition-all relative ${
                      currentCanonical === candidate.personAId && candidate.status === 'pending'
                        ? 'border-[#D4AF37] bg-gradient-to-b from-[#1C1A14] to-[#120F0B] shadow-[0_0_15px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]/40'
                        : 'border-[#2B333C] bg-[#101317]'
                    }`}
                  >
                    <div className="flex items-start justify-between border-b border-[#2B333C] pb-3 gap-2">
                      <div>
                        <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">
                          RECORD FOLIO A
                        </div>
                        <h3 className="font-display font-bold text-lg text-[#F4EDE2] mt-0.5">
                          {candidate.personA?.displayName || 'Record A'}
                        </h3>
                        <div className="text-[10px] font-mono text-[#8C8275]">
                          REGISTRY ID: {candidate.personAId.slice(0, 12).toUpperCase()}...
                        </div>
                      </div>

                      {candidate.status === 'pending' && (
                        <button
                          onClick={() =>
                            setCanonicalSelections((prev) => ({
                              ...prev,
                              [pairKey]: candidate.personAId,
                            }))
                          }
                          className={`text-[10px] font-display font-semibold uppercase px-3 py-1.5 rounded-sm border transition-all tracking-wider shrink-0 ${
                            currentCanonical === candidate.personAId
                              ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                              : 'border-[#2B333C] text-[#8C8275] hover:text-[#F4EDE2] hover:border-[#D4AF37]/40'
                          }`}
                        >
                          {currentCanonical === candidate.personAId ? '✓ Target Canonical' : 'Set as Canonical'}
                        </button>
                      )}
                    </div>

                    {/* Attributes Ledger */}
                    <div className="space-y-2 text-xs font-serif">
                      <div className="flex justify-between py-1.5 border-b border-[#2B333C]/40">
                        <span className="text-[#8C8275]">Birth Record:</span>
                        <span className="text-[#F4EDE2] font-mono font-medium">{birthA}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#2B333C]/40">
                        <span className="text-[#8C8275]">Parish/Location:</span>
                        <span className="text-[#F4EDE2] font-medium">{placeA}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[#8C8275]">Historical Vocation:</span>
                        <span className="text-[#F4EDE2] font-medium">{occA}</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Record B */}
                  <div
                    className={`border-2 rounded-sm p-5 space-y-4 transition-all relative ${
                      currentCanonical === candidate.personBId && candidate.status === 'pending'
                        ? 'border-[#D4AF37] bg-gradient-to-b from-[#1C1A14] to-[#120F0B] shadow-[0_0_15px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]/40'
                        : 'border-[#2B333C] bg-[#101317]'
                    }`}
                  >
                    <div className="flex items-start justify-between border-b border-[#2B333C] pb-3 gap-2">
                      <div>
                        <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">
                          RECORD FOLIO B
                        </div>
                        <h3 className="font-display font-bold text-lg text-[#F4EDE2] mt-0.5">
                          {candidate.personB?.displayName || 'Record B'}
                        </h3>
                        <div className="text-[10px] font-mono text-[#8C8275]">
                          REGISTRY ID: {candidate.personBId.slice(0, 12).toUpperCase()}...
                        </div>
                      </div>

                      {candidate.status === 'pending' && (
                        <button
                          onClick={() =>
                            setCanonicalSelections((prev) => ({
                              ...prev,
                              [pairKey]: candidate.personBId,
                            }))
                          }
                          className={`text-[10px] font-display font-semibold uppercase px-3 py-1.5 rounded-sm border transition-all tracking-wider shrink-0 ${
                            currentCanonical === candidate.personBId
                              ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                              : 'border-[#2B333C] text-[#8C8275] hover:text-[#F4EDE2] hover:border-[#D4AF37]/40'
                          }`}
                        >
                          {currentCanonical === candidate.personBId ? '✓ Target Canonical' : 'Set as Canonical'}
                        </button>
                      )}
                    </div>

                    {/* Attributes Ledger */}
                    <div className="space-y-2 text-xs font-serif">
                      <div className="flex justify-between py-1.5 border-b border-[#2B333C]/40">
                        <span className="text-[#8C8275]">Birth Record:</span>
                        <span className="text-[#F4EDE2] font-mono font-medium">{birthB}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#2B333C]/40">
                        <span className="text-[#8C8275]">Parish/Location:</span>
                        <span className="text-[#F4EDE2] font-medium">{placeB}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[#8C8275]">Historical Vocation:</span>
                        <span className="text-[#F4EDE2] font-medium">{occB}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Heuristic Breakdown Monograph Strip */}
                {b && (
                  <div className="border border-[#D4AF37]/20 bg-[#101317] p-4 rounded-sm space-y-2">
                    <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest flex items-center gap-2">
                      <Binary className="w-3.5 h-3.5" />
                      <span>HEURISTIC SIMILARITY DECOMPOSITION MATRIX</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono text-[#A69B8D]">
                      <div>Name Levenshtein: <span className="text-[#F4EDE2] font-bold">{b.nameScore ?? '—'}/40</span></div>
                      <div>Birth Decade Match: <span className="text-[#F4EDE2] font-bold">{b.birthScore ?? '—'}/25</span></div>
                      <div>Location Token Overlap: <span className="text-[#F4EDE2] font-bold">{b.placeScore ?? '—'}/15</span></div>
                      <div>Kinship Closure Overlap: <span className="text-[#F4EDE2] font-bold">{b.relScore ?? '—'}/20</span></div>
                    </div>
                  </div>
                )}

                {/* Curatorial Resolution Actions */}
                <div className="border-t border-[#D4AF37]/20 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-[#A69B8D] font-serif italic">
                    {candidate.status === 'pending'
                      ? 'Reconciliation non-destructively seals the secondary identity into the canonical dossier, preserving all evidence.'
                      : `Curatorial Decree: ${candidate.decidedAt ? new Date(candidate.decidedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Historical Accession'}`}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {candidate.status === 'pending' ? (
                      <>
                        <button
                          id={`dismiss_candidate_${pairKey}`}
                          onClick={() => handleDismiss(candidate)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-[#101317] hover:bg-[#1A1F26] text-[#A69B8D] hover:text-[#F4EDE2] border border-[#2B333C] rounded-sm text-xs font-display uppercase tracking-wider transition-colors"
                        >
                          Dismiss Candidate
                        </button>
                        <button
                          id={`approve_merge_${pairKey}`}
                          onClick={() => handleApprove(candidate)}
                          disabled={isProcessing}
                          className="px-5 py-2 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display text-xs font-bold uppercase tracking-wider rounded-sm shadow-md transition-all active:scale-95 border border-[#F3E5AB]"
                        >
                          {isProcessing ? 'Sealing...' : 'Approve & Reconcile'}
                        </button>
                      </>
                    ) : candidate.status === 'approved' ? (
                      <button
                        id={`unmerge_candidate_${pairKey}`}
                        onClick={() => handleUnmerge(candidate)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#101317] hover:bg-[#1A1F26] text-[#F4EDE2] border border-[#D4AF37]/40 rounded-sm text-xs font-display uppercase tracking-wider transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Revert Reconciliation</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(candidate)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-[#101317] hover:bg-[#1A1F26] text-[#D4AF37] border border-[#D4AF37]/40 rounded-sm text-xs font-display uppercase tracking-wider transition-colors"
                      >
                        Re-evaluate & Reconcile
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
