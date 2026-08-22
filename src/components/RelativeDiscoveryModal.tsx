import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PersonRecord } from '../types.ts';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Search,
  Users,
  Globe,
  Lock,
  GitMerge,
  ArrowRight,
  HelpCircle,
  FolderTree,
  UserCheck,
} from 'lucide-react';

interface RelativeDiscoveryModalProps {
  person: PersonRecord & { displayName: string };
  onClose: () => void;
  onSelectRelative?: (personId: string) => void;
}

export const RelativeDiscoveryModal: React.FC<RelativeDiscoveryModalProps> = ({
  person,
  onClose,
  onSelectRelative,
}) => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiscovery = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/discovery/search', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.personId }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to execute discovery search.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during discovery search.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runDiscovery();
  }, [person.personId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <span>Relative Discovery for</span>
                <span className="text-amber-300">{person.displayName}</span>
              </h2>
              <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                <span>Status: {person.isLiving ? 'Living Individual' : 'Deceased Individual'}</span>
                <span>•</span>
                <span className="font-mono">Privacy: {person.privacyLevel || 'family_only'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Zero-Leakage Privacy Banner */}
        <div className="bg-stone-950/90 border-b border-stone-800/80 px-5 py-3 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-stone-200">
              Zero-Information-Leak Privacy Guarantee
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Living relatives are only surfaced if <strong>both</strong> you and the other tree owner
              have opted into discovery. When consent is not granted, records are silently excluded with{' '}
              <strong>zero leakage</strong> (no hidden counters or masked placeholders).
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-stone-700 border-t-amber-400 animate-spin mx-auto"></div>
              <p className="text-xs text-stone-400">
                Scanning cross-tree kinship graphs and phonetics with privacy gates...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
              {error}
            </div>
          ) : results ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
                <span>DISCOVERED MATCHES ({results.totalDiscovered})</span>
                <span>
                  Your Consent:{' '}
                  {results.userOptedIn ? (
                    <span className="text-emerald-400 font-semibold">Active</span>
                  ) : (
                    <span className="text-amber-400">Opted Out (Deceased matches only)</span>
                  )}
                </span>
              </div>

              {results.matches && results.matches.length > 0 ? (
                <div className="space-y-3">
                  {results.matches.map((m: any) => (
                    <div
                      key={m.personId}
                      className="p-4 rounded-xl bg-stone-950/70 border border-stone-800/90 space-y-3 hover:border-amber-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-stone-100">{m.name}</h4>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                                m.band === 'strong'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : m.band === 'possible'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-stone-800 text-stone-400'
                              }`}
                            >
                              {m.band} Match ({m.score}/100)
                            </span>
                          </div>

                          <div className="text-xs text-stone-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {m.birthDate && <span>Born: {m.birthDate}</span>}
                            {m.birthPlace && <span>Place: {m.birthPlace}</span>}
                            <span className="flex items-center gap-1 text-stone-400">
                              <FolderTree className="w-3 h-3 text-stone-500" />
                              <span>{m.treeName}</span>
                            </span>
                            <span className="text-stone-500">Owner: {m.ownerDisplayName}</span>
                          </div>
                        </div>

                        {onSelectRelative && (
                          <button
                            onClick={() => {
                              onSelectRelative(m.personId);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 transition-colors shrink-0"
                          >
                            Inspect Person
                          </button>
                        )}
                      </div>

                      {/* Kinship / Relationship Path */}
                      {m.relationshipSummary && (
                        <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-800 text-xs space-y-1">
                          <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>Calculated Kinship: {m.relationshipSummary}</span>
                          </div>
                          {m.connection && (
                            <p className="text-[11px] text-stone-400 leading-tight">
                              {m.connection.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-stone-950/40 rounded-xl border border-stone-800/80 space-y-2">
                  <UserCheck className="w-8 h-8 mx-auto text-stone-600" />
                  <div className="text-xs font-medium text-stone-300">
                    No Discoverable Relatives Found
                  </div>
                  <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                    No duplicate matches or shared lineages with active mutual consent were detected.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/60 flex items-center justify-between">
          <div className="text-[11px] text-stone-400">
            Target Record ID: <span className="font-mono text-stone-300">{person.personId.slice(0, 12)}...</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
