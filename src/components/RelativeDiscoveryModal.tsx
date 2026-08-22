import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  X,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Users,
  Compass,
  CheckCircle2,
  Lock,
  Globe,
  Scroll,
} from 'lucide-react';
import { motion } from 'motion/react';
import { PersonRecord } from '../types.ts';

interface RelativeDiscoveryModalProps {
  person: PersonRecord;
  onClose: () => void;
  onSelectRelative?: (personId: string) => void;
}

export const RelativeDiscoveryModal: React.FC<RelativeDiscoveryModalProps> = ({
  person,
  onClose,
  onSelectRelative,
}) => {
  const { getIdToken } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const discoverRelatives = async () => {
      setLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/discovery/relatives/${person.personId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setMatches(data.matches || []);
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to discover living relatives');
        }
      } catch (err: any) {
        console.error('Discovery error:', err);
        setError(err.message || 'Network discovery error');
      } finally {
        setLoading(false);
      }
    };

    discoverRelatives();
  }, [person.personId]);

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
              <span>ZERO-LEAKAGE RELATIVE DISCOVERY</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              Mutual Consented Relative Discoveries
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs font-sans">
          {/* Dual Consent Privacy Callout */}
          <div className="p-4 bg-[#120F0B] border border-[#D4AF37]/30 rounded-sm space-y-1.5">
            <div className="flex items-center gap-2 font-display uppercase tracking-wider text-[11px] font-semibold text-[#85C49F]">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Information-Leak Living Privacy Guarantee</span>
            </div>
            <p className="text-[11px] font-serif text-[#C4B59D] leading-relaxed italic">
              Living individuals are discoverable only when both the querying researcher and the repository curator have mutually granted opt-in consent. If either party declines, results return an empty payload without leaking presence or record counts.
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-sm animate-spin mx-auto"></div>
              <p className="font-mono text-xs text-[#8C8275] uppercase tracking-widest">Querying mutual consent repositories...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-[#2A1513] border border-[#9C4A3C]/60 rounded-sm text-[#EBB4AC] font-serif">
              {error}
            </div>
          ) : matches.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-[#2B333C] rounded-sm p-6 space-y-2">
              <Compass className="w-8 h-8 text-[#8C8275] mx-auto" />
              <div className="font-display font-bold text-sm text-[#F4EDE2] uppercase tracking-wide">No Consented Lineage Matches Located</div>
              <p className="text-xs font-serif text-[#8C8275] max-w-sm mx-auto italic">
                No external researcher repositories with active mutual consent match this individual's genealogical coordinates.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider">
                DISCOVERED RELATIVES ({matches.length})
              </div>

              {matches.map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[#101317] border border-[#D4AF37]/30 hover:border-[#D4AF37] rounded-sm space-y-2 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-sm text-[#F4EDE2]">
                        {m.displayName}
                      </h4>
                      <div className="text-[10px] text-[#8C8275] font-mono mt-0.5">
                        Repository: {m.treeName || 'Consented Lineage'} • Curator: {m.ownerName || 'Verified Researcher'}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-sm border border-[#4C7A5E] bg-[#162A1F] text-[#85C49F] font-bold tracking-wider">
                      MUTUAL CONSENT
                    </span>
                  </div>

                  {m.relationship && (
                    <div className="text-xs font-serif text-[#C4B59D] italic">
                      Estimated Kinship Vector: <strong className="text-[#F4EDE2] not-italic">{m.relationship}</strong>
                    </div>
                  )}

                  {onSelectRelative && m.personId && (
                    <div className="pt-2 border-t border-[#2B333C] flex justify-end">
                      <button
                        onClick={() => onSelectRelative(m.personId)}
                        className="text-xs text-[#D4AF37] hover:text-[#F4EDE2] flex items-center gap-1.5 font-display uppercase tracking-wider"
                      >
                        <span>Inspect Relative Dossier</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[#D4AF37]/20 bg-[#120F0B]">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#15191E] hover:bg-[#1C222A] text-[#F4EDE2] border border-[#D4AF37]/30 rounded-sm text-xs font-display uppercase tracking-wider transition-colors"
          >
            Close Chamber
          </button>
        </div>
      </motion.div>
    </div>
  );
};
