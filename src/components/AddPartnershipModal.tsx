import React, { useState, useEffect } from 'react';
import {
  PartnershipUnionType,
  UNION_TYPE_LABELS,
  PersonRecord,
} from '../types.ts';
import { X, Heart, Search, Scroll } from 'lucide-react';
import { motion } from 'motion/react';
import { evaluatePersonClaims } from '../utils/claims.ts';

interface AddPartnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPerson: PersonRecord;
  onPartnershipAdded: () => void;
  getIdToken: () => Promise<string | null>;
}

export const AddPartnershipModal: React.FC<AddPartnershipModalProps> = ({
  isOpen,
  onClose,
  currentPerson,
  onPartnershipAdded,
  getIdToken,
}) => {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [partnerId, setPartnerId] = useState<string>('');
  const [unionType, setUnionType] = useState<PartnershipUnionType>('married');
  const [startDate, setStartDate] = useState<string>('');
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
          const candidates = (data.people || []).filter(
            (p: PersonRecord) => p.personId !== currentPerson.personId
          );
          setPeople(candidates);
          if (candidates.length > 0) {
            setPartnerId(candidates[0].personId);
          }
        }
      } catch (err) {
        console.error('Failed to load candidate partners:', err);
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
    if (!partnerId) {
      setError('Please select a partner from the archival registry.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/relationships/partnership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          personAId: currentPerson.personId,
          personBId: partnerId,
          unionType,
          startDate: startDate.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record partnership union');
      }

      onPartnershipAdded();
      onClose();
    } catch (err: any) {
      console.error('Partnership creation error:', err);
      setError(err.message || 'Error recording spousal union');
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
              <span>SPOUSAL & PARTNERSHIP RECORD</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              Record Union with {currentName}
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

          {/* Candidate Selection */}
          <div className="space-y-2">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Select Partner / Spouse From Tree</label>

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
                <div className="p-4 text-center text-[#8C8275] font-mono">Loading candidates...</div>
              ) : filteredCandidates.length === 0 ? (
                <div className="p-4 text-center text-[#64707D] font-serif italic">No eligible candidates found.</div>
              ) : (
                filteredCandidates.map((cand) => {
                  const cEval = evaluatePersonClaims(cand.claims || []);
                  const cName = cEval['name']?.bestClaims[0]?.value || 'Unnamed Individual';
                  const isSelected = partnerId === cand.personId;

                  return (
                    <div
                      key={cand.personId}
                      onClick={() => setPartnerId(cand.personId)}
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

          {/* Union Type */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Union Archetype</label>
            <select
              value={unionType}
              onChange={(e) => setUnionType(e.target.value as PartnershipUnionType)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer font-sans"
            >
              {Object.entries(UNION_TYPE_LABELS).map(([key, info]) => (
                <option key={key} value={key} className="bg-[#15191E]">
                  {info.label} ({info.description})
                </option>
              ))}
            </select>
          </div>

          {/* Marriage Date */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Date of Marriage / Union (Optional)</label>
            <input
              type="text"
              placeholder="e.g., 1895-06-22 or Circa June 1895"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] font-mono"
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
              {isSubmitting ? 'Recording...' : 'Record Partnership Union'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
