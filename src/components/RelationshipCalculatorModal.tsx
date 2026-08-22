import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PersonRecord, RelationshipResult } from '../types.ts';
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
import { RelationshipPathTree } from './RelationshipPathTree.tsx';

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
  const [calculationResult, setCalculationResult] = useState<RelationshipResult | null>(null);

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
      const res = await fetch('/api/relationships/calculate-kinship', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personAId, personBId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to compute kinship path');
      }

      setCalculationResult(data.relationship || data);
    } catch (err: any) {
      console.error('Calculation error:', err);
      setError(err.message || 'Kinship computation error');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.9)] my-6"
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
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                Individual Record A (Origin)
              </label>
              <select
                value={personAId}
                onChange={(e) => setPersonAId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D97706]/40 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D97706] cursor-pointer"
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
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#059669]" />
                Individual Record B (Target)
              </label>
              <select
                value={personBId}
                onChange={(e) => setPersonBId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#059669]/40 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#059669] cursor-pointer"
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
              className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md transition-all active:scale-95 border border-[#F3E5AB] hover:brightness-110 disabled:opacity-50"
            >
              {calculating ? 'Analyzing Transitive Closure Table...' : 'Compute Kinship Matrix & MRCA'}
            </button>
          </div>

          {/* Result Ledger Box */}
          {calculationResult && (
            <div className="space-y-4">
              {calculationResult.areIdentical ? (
                <div className="deco-card border-2 border-[#D4AF37]/40 bg-[#120F0B] rounded-sm p-6 text-center space-y-2">
                  <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em]">
                    IDENTICAL RECORD CHECK
                  </div>
                  <h3 className="text-xl font-display font-bold text-[#F4EDE2] uppercase">
                    Same Person
                  </h3>
                  <p className="text-xs font-serif text-[#C4B59D] italic">
                    {calculationResult.summaryMessage || 'Selected records represent the same individual identity.'}
                  </p>
                </div>
              ) : calculationResult.connections && calculationResult.connections.length > 0 ? (
                <div className="space-y-6">
                  {calculationResult.connections.length > 1 && (
                    <div className="p-3 bg-[#1B150E] border border-[#D4AF37]/40 rounded-sm flex items-center justify-between text-xs">
                      <span className="font-display font-bold text-[#FDE68A] uppercase tracking-wider">
                        Multiple Lineage Paths Detected ({calculationResult.connections.length} MRCA Convergences)
                      </span>
                      <span className="text-[10px] font-mono text-[#D4AF37]">
                        Double Lineage / Collateral Ancestry
                      </span>
                    </div>
                  )}

                  {calculationResult.connections.map((conn, idx) => (
                    <div
                      key={conn.connectionId || idx}
                      className="deco-card border-2 border-[#D4AF37]/40 bg-[#120F0B] rounded-sm p-5 sm:p-6 space-y-4 shadow-lg"
                    >
                      {/* Header with Relationship Label & Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4AF37]/20 pb-4">
                        <div>
                          <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em]">
                            {calculationResult.connections.length > 1 ? `CONVERGENCE PATH #${idx + 1}` : 'CANONICAL KINSHIP DETERMINATION'}
                          </div>
                          <h3 className="text-2xl font-display font-bold text-[#F4EDE2] tracking-wide uppercase mt-0.5">
                            {conn.relationshipLabel}
                          </h3>
                        </div>

                        {/* Badges & Meta */}
                        <div className="flex flex-wrap items-center gap-2">
                          {conn.isCouple && (
                            <span className="px-2.5 py-1 rounded-sm text-[10px] font-mono font-bold bg-[#261742] text-[#DDD6FE] border border-[#8B5CF6]/50 uppercase tracking-wider">
                              ⚭ Coupled Ancestors
                            </span>
                          )}
                          {conn.isHalf && (
                            <span className="px-2.5 py-1 rounded-sm text-[10px] font-mono font-bold bg-[#2A1B0B] text-[#FDE68A] border border-[#D97706]/50 uppercase tracking-wider">
                              Half-Lineage
                            </span>
                          )}
                          <span className="px-2.5 py-1 rounded-sm text-[10px] font-mono bg-[#15191E] text-[#D4AF37] border border-[#D4AF37]/30">
                            A: {conn.genDistanceA} gen • B: {conn.genDistanceB} gen
                          </span>
                          {conn.removed > 0 && (
                            <span className="px-2.5 py-1 rounded-sm text-[10px] font-mono bg-[#1E293B] text-[#93C5FD] border border-[#3B82F6]/30">
                              {conn.removed}x Removed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Explanation text */}
                      {conn.explanation && (
                        <div className="p-3 bg-[#15191E] border-l-2 border-[#D4AF37] text-xs font-serif text-[#C4B59D] italic">
                          {conn.explanation}
                        </div>
                      )}

                      {/* Connected Relationship Path Tree Visual Diagram */}
                      <RelationshipPathTree
                        connection={conn}
                        personA={calculationResult.personA}
                        personB={calculationResult.personB}
                        onSelectPerson={(personId) => {
                          onClose();
                          onSelectPerson?.(personId);
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="deco-card border border-[#D4AF37]/30 bg-[#120F0B] rounded-sm p-6 text-center space-y-2">
                  <div className="text-[10px] font-mono text-[#8C8275] uppercase tracking-wider">
                    CLOSURE GRAPH TRAVERSAL RESULT
                  </div>
                  <p className="text-xs font-serif text-[#8C8275] italic">
                    {calculationResult.summaryMessage || 'No common ancestor found between the selected records within 10 generations.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
