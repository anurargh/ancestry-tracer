import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  PersonRecord,
  RelationshipResult,
  MRCAConnection,
  PathPersonNode,
} from '../types.ts';
import { evaluatePersonClaims } from '../utils/claims.ts';
import {
  GitMerge,
  Search,
  ArrowRight,
  Sparkles,
  Users,
  ChevronRight,
  Info,
  RefreshCw,
  X,
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  CornerDownRight,
  GitBranch,
} from 'lucide-react';

interface RelationshipCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPersonAId?: string | null;
  initialPersonBId?: string | null;
  onSelectPerson?: (personId: string) => void;
}

export const RelationshipCalculatorModal: React.FC<RelationshipCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialPersonAId,
  initialPersonBId,
  onSelectPerson,
}) => {
  const { user, getIdToken } = useAuth();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loadingPeople, setLoadingPeople] = useState<boolean>(false);

  const [personAId, setPersonAId] = useState<string>(initialPersonAId || '');
  const [personBId, setPersonBId] = useState<string>(initialPersonBId || '');

  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');

  const [calculating, setCalculating] = useState<boolean>(false);
  const [result, setResult] = useState<RelationshipResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Fetch people list when modal opens
  useEffect(() => {
    if (!isOpen || !user) return;
    const fetchAllPeople = async () => {
      try {
        setLoadingPeople(true);
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch('/api/people', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPeople(data.people || []);
        }
      } catch (err) {
        console.error('Error fetching people for calculator:', err);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchAllPeople();
  }, [isOpen, user]);

  // Sync initial props
  useEffect(() => {
    if (initialPersonAId) setPersonAId(initialPersonAId);
    if (initialPersonBId) setPersonBId(initialPersonBId);
  }, [initialPersonAId, initialPersonBId]);

  // Auto-calculate if both are provided
  useEffect(() => {
    if (personAId && personBId && isOpen) {
      handleCalculate();
    }
  }, [personAId, personBId, isOpen]);

  const handleCalculate = async () => {
    if (!personAId || !personBId) return;
    try {
      setCalculating(true);
      setCalcError(null);
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/relationships/calculate-kinship', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ personAId, personBId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to calculate relationship');
      }

      setResult(data.relationship);
    } catch (err: any) {
      console.error('Error calculating relationship:', err);
      setCalcError(err.message || 'Kinship computation error');
      setResult(null);
    } finally {
      setCalculating(false);
    }
  };

  const swapPersons = () => {
    const temp = personAId;
    setPersonAId(personBId);
    setPersonBId(temp);
  };

  if (!isOpen) return null;

  const getDisplayName = (p: PersonRecord) => {
    const ev = evaluatePersonClaims(p.claims || []);
    return ev['name']?.bestClaims[0]?.value || `Person (${p.personId.slice(0, 8)})`;
  };

  const getBirth = (p: PersonRecord) => {
    const ev = evaluatePersonClaims(p.claims || []);
    return ev['birth_date']?.bestClaims[0]?.value || '';
  };

  const filteredA = people.filter((p) => {
    const name = getDisplayName(p).toLowerCase();
    return name.includes(searchA.toLowerCase());
  });

  const filteredB = people.filter((p) => {
    const name = getDisplayName(p).toLowerCase();
    return name.includes(searchB.toLowerCase());
  });

  const selectedPersonA = people.find((p) => p.personId === personAId);
  const selectedPersonB = people.find((p) => p.personId === personBId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-stone-800 bg-stone-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-100 font-serif">
                  Kinship Relationship Calculator
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50">
                  MRCA & Closure Engine
                </span>
              </div>
              <p className="text-xs text-stone-400">
                &ldquo;How am I related to X?&rdquo; &bull; Computes kinship paths &amp; MRCAs using transitive PostgreSQL closure reachability.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Person Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
            {/* Person A Selector */}
            <div className="md:col-span-5 rounded-xl bg-stone-950/80 border border-stone-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Person A (Self / Root)
                </span>
                {selectedPersonA && (
                  <span className="text-[11px] text-stone-400 truncate max-w-[150px]">
                    {getDisplayName(selectedPersonA)}
                  </span>
                )}
              </div>

              <div>
                <select
                  id="calc-person-a-select"
                  value={personAId}
                  onChange={(e) => setPersonAId(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-750 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Select Person A --</option>
                  {people.map((p) => {
                    const b = getBirth(p);
                    return (
                      <option key={p.personId} value={p.personId}>
                        {getDisplayName(p)} {b ? `(b. ${b})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Swap & Action Button */}
            <div className="md:col-span-1 flex justify-center">
              <button
                type="button"
                onClick={swapPersons}
                disabled={!personAId || !personBId}
                title="Swap Person A and Person B"
                className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-300 hover:text-amber-400 transition-all disabled:opacity-40"
              >
                <GitMerge className="w-4 h-4 rotate-90 md:rotate-0" />
              </button>
            </div>

            {/* Person B Selector */}
            <div className="md:col-span-5 rounded-xl bg-stone-950/80 border border-stone-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Person B (Target Relative)
                </span>
                {selectedPersonB && (
                  <span className="text-[11px] text-stone-400 truncate max-w-[150px]">
                    {getDisplayName(selectedPersonB)}
                  </span>
                )}
              </div>

              <div>
                <select
                  id="calc-person-b-select"
                  value={personBId}
                  onChange={(e) => setPersonBId(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-750 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Person B --</option>
                  {people.map((p) => {
                    const b = getBirth(p);
                    return (
                      <option key={p.personId} value={p.personId}>
                        {getDisplayName(p)} {b ? `(b. ${b})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-stone-400">
              {loadingPeople ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  Loading people from database...
                </span>
              ) : (
                <span>
                  Select any two individuals from the registry to determine their kinship relationship.
                </span>
              )}
            </div>

            <button
              id="calc-submit-btn"
              onClick={handleCalculate}
              disabled={!personAId || !personBId || calculating}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {calculating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing MRCA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Calculate Relationship</span>
                </>
              )}
            </button>
          </div>

          {/* Calculation Error */}
          {calcError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{calcError}</span>
            </div>
          )}

          {/* Calculation Results */}
          {result && (
            <div className="space-y-6 pt-2">
              {/* Primary Relationship Banner */}
              <div className="p-5 rounded-2xl bg-stone-950 border border-stone-800 space-y-3 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-850">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400">Kinship Result:</span>
                    <span className="text-sm font-semibold text-stone-200">
                      {result.personA.displayName} &bull; {result.personB.displayName}
                    </span>
                  </div>
                  {result.connections.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900 text-stone-300 border border-stone-800">
                      {result.connections.length} MRCA Connection{result.connections.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-amber-300 font-serif">
                      {result.areIdentical
                        ? 'Same Person'
                        : result.connections.length > 0
                        ? result.connections[0].relationshipLabel
                        : 'Unrelated (Within 10 Generations)'}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-300 mt-0.5">
                      {result.summaryMessage}
                    </p>
                  </div>
                </div>
              </div>

              {/* MRCA Connections & Paths */}
              {result.connections.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-stone-200 font-serif flex items-center gap-2">
                    <span>Most Recent Common Ancestors &amp; Lineage Paths</span>
                  </h4>

                  <div className="space-y-4">
                    {result.connections.map((conn, idx) => (
                      <div
                        key={conn.connectionId || idx}
                        className="rounded-xl bg-stone-950/70 border border-stone-800 p-5 space-y-4 shadow-sm"
                      >
                        {/* Connection Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-amber-400 font-mono">
                              Connection #{idx + 1}:
                            </span>
                            <span className="text-sm font-bold text-stone-100">
                              {conn.relationshipLabel}
                            </span>
                            {conn.isCouple && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                                Full Couple Shared
                              </span>
                            )}
                            {conn.isHalf && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/50">
                                Half-Kinship (Single Shared Ancestor)
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-mono text-stone-400 flex items-center gap-2">
                            <span>Dist A: {conn.genDistanceA} gen</span>
                            <span>&bull;</span>
                            <span>Dist B: {conn.genDistanceB} gen</span>
                            {conn.removed > 0 && (
                              <>
                                <span>&bull;</span>
                                <span className="text-amber-400">
                                  {conn.removed}x Removed
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Explanation Text */}
                        <p className="text-xs text-stone-300 leading-relaxed bg-stone-900/60 p-3 rounded-lg border border-stone-800/60">
                          <strong className="text-stone-200">Explanation: </strong>
                          {conn.explanation}
                        </p>

                        {/* Path 1: From Person A to Ancestor */}
                        <div className="space-y-2">
                          <div className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>
                              Lineage Path from {result.personA.displayName} to{' '}
                              {conn.ancestor1.name} ({conn.ancestor1.pathA.length - 1} steps):
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-stone-900/80 border border-stone-800">
                            {conn.ancestor1.pathA.map((node, nIdx) => (
                              <React.Fragment key={node.personId + nIdx}>
                                <button
                                  type="button"
                                  onClick={() => onSelectPerson && onSelectPerson(node.personId)}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                    nIdx === 0
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold'
                                      : nIdx === conn.ancestor1.pathA.length - 1
                                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 font-semibold'
                                      : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                                  }`}
                                >
                                  {node.name}
                                  <span className="ml-1.5 text-[9px] font-mono opacity-70">
                                    (G{node.generationDistance})
                                  </span>
                                </button>
                                {nIdx < conn.ancestor1.pathA.length - 1 && (
                                  <ArrowRight className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Path 2: From Person B to Ancestor */}
                        <div className="space-y-2">
                          <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>
                              Lineage Path from {result.personB.displayName} to{' '}
                              {conn.ancestor1.name} ({conn.ancestor1.pathB.length - 1} steps):
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-stone-900/80 border border-stone-800">
                            {conn.ancestor1.pathB.map((node, nIdx) => (
                              <React.Fragment key={node.personId + nIdx}>
                                <button
                                  type="button"
                                  onClick={() => onSelectPerson && onSelectPerson(node.personId)}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                    nIdx === 0
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold'
                                      : nIdx === conn.ancestor1.pathB.length - 1
                                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 font-semibold'
                                      : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                                  }`}
                                >
                                  {node.name}
                                  <span className="ml-1.5 text-[9px] font-mono opacity-70">
                                    (G{node.generationDistance})
                                  </span>
                                </button>
                                {nIdx < conn.ancestor1.pathB.length - 1 && (
                                  <ArrowRight className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* If couple, display partner details as well */}
                        {conn.isCouple && conn.ancestor2 && (
                          <div className="pt-2 border-t border-stone-800/80 text-xs text-stone-400 flex items-center gap-2">
                            <Users className="w-4 h-4 text-stone-400" />
                            <span>
                              Couple partner:{' '}
                              <strong className="text-stone-200">{conn.ancestor2.name}</strong>{' '}
                              shares the exact corresponding ancestral path.
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/60 flex items-center justify-between">
          <div className="text-[11px] font-mono text-stone-400">
            Closure Transitive Intersection &bull; DAG MRCA Filter &bull; 10-Gen Limit
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
