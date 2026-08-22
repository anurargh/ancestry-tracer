import React, { useState, useEffect } from 'react';
import {
  ParentChildRelationshipType,
  SourceType,
  SOURCE_TYPE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  PersonRecord,
} from '../types.ts';
import {
  X,
  Plus,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  Info,
  Users,
  Search,
  Scroll,
} from 'lucide-react';
import { motion } from 'motion/react';
import { evaluatePersonClaims } from '../utils/claims.ts';

interface AddParentChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPerson: PersonRecord;
  mode: 'parent' | 'child'; // 'parent' = linking a parent to currentPerson; 'child' = linking a child
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
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [relationshipType, setRelationshipType] =
    useState<ParentChildRelationshipType>('biological');
  const [sourceType, setSourceType] = useState<SourceType>('certificate');
  const [citation, setCitation] = useState<string>('');
  const [reliabilityTier, setReliabilityTier] = useState<number>(5);
  const [confidence, setConfidence] = useState<number>(95);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTreePeople = async () => {
      setLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/people?treeId=${currentPerson.treeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out current person
          const candidates = (data.people || []).filter(
            (p: PersonRecord) => p.personId !== currentPerson.personId
          );
          setPeople(candidates);
          if (candidates.length > 0) {
            setSelectedPersonId(candidates[0].personId);
          }
        }
      } catch (err) {
        console.error('Failed to load candidate people:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTreePeople();
  }, [isOpen, currentPerson.personId, currentPerson.treeId]);

  if (!isOpen) return null;

  const currentEval = evaluatePersonClaims(currentPerson.claims || []);
  const currentName = currentEval['name']?.bestClaims[0]?.value || 'Current Record';

  const filteredCandidates = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const pEval = evaluatePersonClaims(p.claims || []);
    const pName = (pEval['name']?.bestClaims[0]?.value || '').toLowerCase();
    return pName.includes(searchQuery.toLowerCase());
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) {
      setError('Please select an individual relative from the registry.');
      return;
    }
    if (!citation.trim()) {
      setError('A provenance citation is required for genealogical integrity.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const parentId = mode === 'parent' ? selectedPersonId : currentPerson.personId;
    const childId = mode === 'parent' ? currentPerson.personId : selectedPersonId;

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
          citation: citation.trim(),
          reliabilityTier,
          confidence,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to establish parent-child relationship');
      }

      onRelationshipAdded();
      onClose();
    } catch (err: any) {
      console.error('Relationship link error:', err);
      setError(err.message || 'Error establishing relationship edge');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm w-full max-w-xl max-h-[90vh] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.8)] my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#D4AF37]/30 bg-[#120F0B]">
          <div>
            <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Scroll className="w-3.5 h-3.5" />
              <span>KINSHIP DIRECTED GRAPH EDGE</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              {mode === 'parent' ? `Link Parent to ${currentName}` : `Link Child to ${currentName}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-[#8C8275] hover:text-[#F4EDE2] hover:bg-[#1A1F26] transition-colors border border-transparent hover:border-[#D4AF37]/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs font-sans">
          {error && (
            <div className="p-3.5 rounded-sm border border-[#9C4A3C]/60 bg-[#2A1513] text-[#EBB4AC] font-serif">
              {error}
            </div>
          )}

          {/* DAG Cycle Callout */}
          <div className="p-3.5 rounded-sm bg-[#120F0B] border border-[#D4AF37]/30 text-[#C4B59D] space-y-1">
            <div className="flex items-center gap-2 font-display uppercase tracking-wider text-[11px] text-[#85C49F] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DAG Cycle Invariant & Transitive Closure Sync</span>
            </div>
            <p className="text-[11px] font-serif leading-relaxed italic">
              FamilyGraph executes BFS validation prior to commitment to guarantee strict directed acyclicity, preventing genealogical paradoxes and instantly updating transitive kinship closure indices.
            </p>
          </div>

          {/* Candidate Selection */}
          <div className="space-y-2">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">
              Select {mode === 'parent' ? 'Parent' : 'Child'} Individual From Tree
            </label>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8C8275] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter individuals by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] placeholder:text-[#64707D] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="max-h-40 overflow-y-auto border border-[#2B333C] bg-[#101317] rounded-sm divide-y divide-[#2B333C]">
              {loading ? (
                <div className="p-4 text-center text-[#8C8275] font-mono">Loading eligible candidates...</div>
              ) : filteredCandidates.length === 0 ? (
                <div className="p-4 text-center text-[#64707D] font-serif italic">No eligible records found in this repository.</div>
              ) : (
                filteredCandidates.map((cand) => {
                  const cEval = evaluatePersonClaims(cand.claims || []);
                  const cName = cEval['name']?.bestClaims[0]?.value || 'Unnamed Individual';
                  const isSelected = selectedPersonId === cand.personId;

                  return (
                    <div
                      key={cand.personId}
                      onClick={() => setSelectedPersonId(cand.personId)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-all ${
                        isSelected ? 'bg-gradient-to-r from-[#1C1A14] to-[#15191E] border-l-2 border-[#D4AF37]' : 'hover:bg-[#15191E]'
                      }`}
                    >
                      <div>
                        <div className="font-display font-semibold text-xs text-[#F4EDE2]">{cName}</div>
                        <div className="text-[10px] text-[#8C8275] font-mono">
                          FOLIO ID: {cand.personId.slice(0, 12).toUpperCase()}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-display uppercase tracking-wider text-[#D4AF37] px-2 py-0.5 bg-[#120F0B] border border-[#D4AF37]/30 rounded-sm font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Relationship Type */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Kinship Relationship Mode</label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as ParentChildRelationshipType)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer font-sans"
            >
              {Object.entries(RELATIONSHIP_TYPE_LABELS).map(([key, info]) => (
                <option key={key} value={key} className="bg-[#15191E]">
                  {info.label} ({info.description})
                </option>
              ))}
            </select>
          </div>

          {/* Source Type & Citation */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Source Document Archetype</label>
            <select
              value={sourceType}
              onChange={(e) => {
                const st = e.target.value as SourceType;
                setSourceType(st);
                setReliabilityTier(SOURCE_TYPE_LABELS[st]?.defaultTier || 4);
              }}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer font-sans"
            >
              {Object.entries(SOURCE_TYPE_LABELS).map(([key, info]) => (
                <option key={key} value={key} className="bg-[#15191E]">
                  {info.label} (Tier {info.defaultTier})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Evidential Provenance Citation</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Parish Baptismal Register, St. Luke Parish, Page 44, Entry #114..."
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#D4AF37]/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#A69B8D] hover:text-[#F4EDE2] font-display uppercase text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md transition-all active:scale-95 border border-[#F3E5AB]"
            >
              {isSubmitting ? 'Linking...' : 'Establish Kinship Link'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
