import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PersonRecord } from '../types.ts';
import {
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  Users,
  Sparkles,
  GitBranch,
  Scroll,
} from 'lucide-react';
import { motion } from 'motion/react';
import { evaluatePersonClaims } from '../utils/claims.ts';

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
  const { getIdToken } = useAuth();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [personAId, setPersonAId] = useState<string>(initialPersonAId || '');
  const [personBId, setPersonBId] = useState<string>(initialPersonBId || '');
  const [calculationResult, setCalculationResult] = useState<{
    relationship: string;
    commonAncestors: { ancestorId: string; displayName: string; distanceA: number; distanceB: number }[];
    mrcaName?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAllPeople = async () => {
      setLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch('/api/people', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPeople(data.people || []);
          if (!personAId && data.people && data.people.length > 0) {
            setPersonAId(data.people[0].personId);
          }
          if (!personBId && data.people && data.people.length > 1) {
            setPersonBId(data.people[1].personId);
          }
        }
      } catch (err) {
        console.error('Failed to load people:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPeople();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCalculate = async () => {
    if (!personAId || !personBId) {
      setError('Please select both individuals for kinship analysis.');
      return;
    }
    if (personAId === personBId) {
      setError('Selected the identical record for both targets. Please pick two distinct individuals.');
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch(
        `/api/relationships/calculate?personAId=${personAId}&personBId=${personBId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to compute kinship path');
      }

      setCalculationResult(data);
    } catch (err: any) {
      console.error('Calculation error:', err);
      setError(err.message || 'Kinship computation error');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.8)] my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#D4AF37]/30 bg-[#120F0B]">
          <div>
            <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Scroll className="w-3.5 h-3.5" />
              <span>KINSHIP CANONICAL CALCULATOR</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              MRCA & Generational Kinship Matrix
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-[#8C8275] hover:text-[#F4EDE2] hover:bg-[#1A1F26] transition-colors border border-transparent hover:border-[#D4AF37]/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-sans">
          {error && (
            <div className="p-3.5 rounded-sm border border-[#9C4A3C]/60 bg-[#2A1513] text-[#EBB4AC] font-serif">
              {error}
            </div>
          )}

          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Individual Record A</label>
              <select
                value={personAId}
                onChange={(e) => setPersonAId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
              >
                {people.map((p) => {
                  const evalData = evaluatePersonClaims(p.claims || []);
                  const name = evalData['name']?.bestClaims[0]?.value || 'Unnamed Record';
                  return (
                    <option key={p.personId} value={p.personId} className="bg-[#15191E]">
                      {name} ({p.personId.slice(0, 8)}...)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Individual Record B</label>
              <select
                value={personBId}
                onChange={(e) => setPersonBId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
              >
                {people.map((p) => {
                  const evalData = evaluatePersonClaims(p.claims || []);
                  const name = evalData['name']?.bestClaims[0]?.value || 'Unnamed Record';
                  return (
                    <option key={p.personId} value={p.personId} className="bg-[#15191E]">
                      {name} ({p.personId.slice(0, 8)}...)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md transition-all active:scale-95 border border-[#F3E5AB]"
            >
              {calculating ? 'Analyzing Transitive Closure Table...' : 'Compute Kinship Matrix & MRCA'}
            </button>
          </div>

          {/* Result Ledger Box */}
          {calculationResult && (
            <div className="deco-card border-2 border-[#D4AF37]/40 bg-[#120F0B] rounded-sm p-6 space-y-4 shadow-lg">
              <div className="text-center space-y-1 border-b border-[#D4AF37]/20 pb-4">
                <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em]">
                  CANONICAL KINSHIP DETERMINATION
                </div>
                <h3 className="text-2xl font-display font-bold text-[#F4EDE2] tracking-wide uppercase">
                  {calculationResult.relationship}
                </h3>
              </div>

              {calculationResult.commonAncestors && calculationResult.commonAncestors.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="text-[10px] font-mono text-[#8C8275] uppercase tracking-wider">
                    MOST RECENT COMMON ANCESTORS (MRCA) FOUND IN CLOSURE GRAPH
                  </div>
                  <div className="space-y-2">
                    {calculationResult.commonAncestors.map((anc) => (
                      <div
                        key={anc.ancestorId}
                        className="p-4 bg-[#15191E] border border-[#D4AF37]/30 rounded-sm flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="font-display font-bold text-sm text-[#F4EDE2]">
                            {anc.displayName}
                          </div>
                          <div className="text-[10px] text-[#8C8275] font-mono">
                            FOLIO UUID: {anc.ancestorId.slice(0, 16).toUpperCase()}...
                          </div>
                        </div>

                        <div className="text-right text-[11px] font-mono text-[#D4AF37] space-y-0.5">
                          <div>Lineage Path A: <span className="font-bold">{anc.distanceA} gens</span></div>
                          <div>Lineage Path B: <span className="font-bold">{anc.distanceB} gens</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs font-serif text-[#8C8275] italic">
                  No common bloodline ancestor was located in current transitive closure trees.
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
