import React, { useState, useEffect } from 'react';
import {
  PersonRecord,
  ParentChildRelationshipType,
  RELATIONSHIP_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  SourceType,
} from '../types.ts';
import { evaluatePersonClaims } from '../utils/claims.ts';
import {
  X,
  UserCheck,
  AlertTriangle,
  GitBranch,
  ShieldCheck,
  FileText,
  Search,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface AddParentChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPerson: PersonRecord;
  mode: 'parent' | 'child'; // 'parent' means adding a parent TO currentPerson; 'child' means adding a child TO currentPerson
  onRelationshipAdded: () => void;
  getIdToken: () => Promise<string | null>;
}

export const AddParentChildModal: React.FC<AddParentChildModalProps> = ({
  isOpen,
  onClose,
  currentPerson,
  mode,
  onRelationshipAdded,
  getIdToken,
}) => {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loadingPeople, setLoadingPeople] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [relationshipType, setRelationshipType] =
    useState<ParentChildRelationshipType>('biological');

  // Provenance / Source inputs
  const [sourceType, setSourceType] = useState<SourceType>('certificate');
  const [citation, setCitation] = useState<string>('');
  const [reliabilityTier, setReliabilityTier] = useState<number>(5);
  const [confidence, setConfidence] = useState<number>(95);

  // Cycle check state
  const [checkingCycle, setCheckingCycle] = useState<boolean>(false);
  const [cycleConflict, setCycleConflict] = useState<{
    hasCycle: boolean;
    errorMessage?: string;
    pathNames?: string[];
  } | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentPersonEval = evaluatePersonClaims(currentPerson.claims || []);
  const currentPersonName =
    currentPersonEval['name']?.bestClaims[0]?.value || `Person (${currentPerson.personId.slice(0, 8)})`;

  // Fetch all people in the registry to select from
  useEffect(() => {
    if (!isOpen) return;
    const fetchAllPeople = async () => {
      setLoadingPeople(true);
      try {
        const token = await getIdToken();
        const res = await fetch('/api/people', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out current person and those who are already linked in this role
          const list: PersonRecord[] = (data.people || []).filter(
            (p: PersonRecord) => p.personId !== currentPerson.personId
          );
          setPeople(list);
        }
      } catch (err) {
        console.error('Failed to fetch people for relationship picker:', err);
      } finally {
        setLoadingPeople(false);
      }
    };

    fetchAllPeople();
  }, [isOpen, currentPerson.personId]);

  // Handle source type default tier updates
  const handleSourceTypeChange = (newType: SourceType) => {
    setSourceType(newType);
    setReliabilityTier(SOURCE_TYPE_LABELS[newType]?.defaultTier || 3);
  };

  // Perform cycle check whenever the selected person changes
  useEffect(() => {
    if (!selectedPersonId) {
      setCycleConflict(null);
      return;
    }

    const parentId = mode === 'parent' ? selectedPersonId : currentPerson.personId;
    const childId = mode === 'parent' ? currentPerson.personId : selectedPersonId;

    let isMounted = true;
    const runCycleCheck = async () => {
      setCheckingCycle(true);
      setError(null);
      try {
        const token = await getIdToken();
        const res = await fetch('/api/relationships/check-cycle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ parentId, childId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.hasCycle) {
              setCycleConflict({
                hasCycle: true,
                errorMessage: data.errorMessage,
                pathNames: data.pathNames,
              });
            } else {
              setCycleConflict(null);
            }
          }
        }
      } catch (err) {
        console.error('Preflight cycle check error:', err);
      } finally {
        if (isMounted) setCheckingCycle(false);
      }
    };

    runCycleCheck();

    return () => {
      isMounted = false;
    };
  }, [selectedPersonId, mode, currentPerson.personId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) {
      setError('Please select an individual from the list.');
      return;
    }

    const parentId = mode === 'parent' ? selectedPersonId : currentPerson.personId;
    const childId = mode === 'parent' ? currentPerson.personId : selectedPersonId;

    setSaving(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/relationships/parent-child', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          parentId,
          childId,
          relationshipType,
          sourceType,
          citation: citation.trim() || undefined,
          reliabilityTier: Number(reliabilityTier),
          confidence: Number(confidence),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.cycleDetails?.hasCycle || data.message?.includes('Cycle')) {
          setCycleConflict({
            hasCycle: true,
            errorMessage: data.message || data.error,
            pathNames: data.cycleDetails?.pathNames,
          });
          throw new Error(data.message || data.error || 'Genealogical cycle detected.');
        }
        throw new Error(data.error || 'Failed to save parent-child relationship.');
      }

      onRelationshipAdded();
      onClose();
    } catch (err: any) {
      console.error('Error creating parent-child relationship:', err);
      setError(err.message || 'Failed to save relationship.');
    } finally {
      setSaving(false);
    }
  };

  // Filter people by query
  const filteredPeople = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const evalData = evaluatePersonClaims(p.claims || []);
    const name = evalData['name']?.bestClaims[0]?.value?.toLowerCase() || '';
    const birth = evalData['birth_date']?.bestClaims[0]?.value?.toLowerCase() || '';
    const place = evalData['birth_place']?.bestClaims[0]?.value?.toLowerCase() || '';
    return name.includes(q) || birth.includes(q) || place.includes(q) || p.personId.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100 font-serif">
                {mode === 'parent' ? 'Link Parent' : 'Link Child'}
              </h2>
              <p className="text-xs text-stone-400">
                {mode === 'parent' ? (
                  <>
                    Designate an existing person as a parent of{' '}
                    <strong className="text-amber-300">{currentPersonName}</strong>
                  </>
                ) : (
                  <>
                    Designate an existing person as a child of{' '}
                    <strong className="text-amber-300">{currentPersonName}</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            id="close-parent-child-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cycle Detection Warning Banner */}
          {cycleConflict?.hasCycle && (
            <div
              id="cycle-conflict-alert"
              className="p-4 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs space-y-2 animate-fadeIn"
            >
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Genealogical Cycle Detected — Lineage Conflict</span>
              </div>
              <p className="leading-relaxed">
                {cycleConflict.errorMessage ||
                  'Cannot create this relationship because it would cause an individual to become their own ancestor.'}
              </p>
              {cycleConflict.pathNames && cycleConflict.pathNames.length > 0 && (
                <div className="p-2.5 rounded-lg bg-black/40 border border-rose-800/40 font-mono text-[11px] text-rose-300">
                  <span className="text-stone-400">Cycle Path: </span>
                  {cycleConflict.pathNames.join(' → ')}
                </div>
              )}
              <div className="text-[11px] text-rose-400 font-mono pt-1">
                Rule: A person can never be their own ancestor. Please choose a different relative.
              </div>
            </div>
          )}

          {error && !cycleConflict?.hasCycle && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Target Person Picker */}
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold">
              1. Select {mode === 'parent' ? 'Parent' : 'Child'} from Registry
            </label>

            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="text"
                placeholder="Search registry by name, birth year, or place..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* People Selection List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 rounded-xl bg-stone-950/70 border border-stone-800">
              {loadingPeople ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  Loading registry records...
                </div>
              ) : filteredPeople.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  No matching individuals available.
                </div>
              ) : (
                filteredPeople.map((p) => {
                  const evalData = evaluatePersonClaims(p.claims || []);
                  const name = evalData['name']?.bestClaims[0]?.value || 'Unnamed Person';
                  const birth = evalData['birth_date']?.bestClaims[0]?.value;
                  const isSelected = selectedPersonId === p.personId;

                  return (
                    <div
                      key={p.personId}
                      id={`select-person-${p.personId}`}
                      onClick={() => setSelectedPersonId(p.personId)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm'
                          : 'bg-stone-900/80 border-stone-850 hover:bg-stone-850 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-amber-400 bg-amber-400 text-stone-950'
                              : 'border-stone-600 bg-stone-800'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                        </div>
                        <div>
                          <span className="font-semibold text-stone-100 font-serif">{name}</span>
                          {birth && <span className="text-stone-400 ml-2">(Born: {birth})</span>}
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-stone-500">
                        {p.personId.slice(0, 8)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: Relationship Type */}
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold">
              2. Relationship Lineage Type
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  'biological',
                  'adoptive',
                  'step',
                  'foster',
                ] as ParentChildRelationshipType[]
              ).map((type) => {
                const isSelected = relationshipType === type;
                const info = RELATIONSHIP_TYPE_LABELS[type];

                return (
                  <button
                    key={type}
                    type="button"
                    id={`rel-type-${type}-btn`}
                    onClick={() => setRelationshipType(type)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/60 text-amber-200 shadow-sm'
                        : 'bg-stone-950 border-stone-800 hover:bg-stone-850 text-stone-400'
                    }`}
                  >
                    <div className="font-semibold text-xs capitalize text-stone-200">
                      {info.label.replace(' Parent', '')}
                    </div>
                    <div className="text-[10px] text-stone-500 leading-tight mt-0.5 line-clamp-2">
                      {info.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Sourced Evidence & Citation */}
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
              <ShieldCheck className="w-4 h-4" />
              <span>3. Provenance & Source Citation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Source Document Type
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => handleSourceTypeChange(e.target.value as SourceType)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label} (Tier {item.defaultTier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Reliability Rating (Tier 1–5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={reliabilityTier}
                  onChange={(e) => setReliabilityTier(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 font-mono focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">
                Citation & Archive Reference
              </label>
              <textarea
                rows={2}
                placeholder="e.g. 1910 Federal Census District 4, Birth Certificate #8812, Family Bible record..."
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-stone-400 mb-1">
                <span>Confidence Assertion</span>
                <span className="text-amber-400 font-semibold">{confidence}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-800">
            <button
              type="button"
              id="cancel-parent-child-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="submit-parent-child-btn"
              disabled={
                saving ||
                checkingCycle ||
                !selectedPersonId ||
                Boolean(cycleConflict?.hasCycle)
              }
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {saving
                  ? 'Verifying & Saving...'
                  : checkingCycle
                  ? 'Checking Lineage Cycles...'
                  : `Save ${mode === 'parent' ? 'Parent' : 'Child'} Link`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
