import React, { useState } from 'react';
import { SourceType, SOURCE_TYPE_LABELS, PersonRecord } from '../types.ts';
import {
  X,
  Plus,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  Briefcase,
  User,
} from 'lucide-react';

interface CreatePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonCreated: (newPerson: PersonRecord) => void;
  getIdToken: () => Promise<string | null>;
}

interface ClaimFormState {
  value: string;
  sourceType: SourceType;
  citation: string;
  reliabilityTier: number;
  confidence: number;
}

export const CreatePersonModal: React.FC<CreatePersonModalProps> = ({
  isOpen,
  onClose,
  onPersonCreated,
  getIdToken,
}) => {
  const [isLiving, setIsLiving] = useState<boolean>(true);
  const [privacyLevel, setPrivacyLevel] = useState<string>('family_only');
  const [ancestryStatus, setAncestryStatus] = useState<string>('direct_ancestor');

  // Initial claims state
  const [nameClaim, setNameClaim] = useState<ClaimFormState>({
    value: '',
    sourceType: 'certificate',
    citation: 'Standard primary record citation',
    reliabilityTier: 5,
    confidence: 95,
  });

  const [birthDateClaim, setBirthDateClaim] = useState<ClaimFormState>({
    value: '',
    sourceType: 'certificate',
    citation: 'Parish baptism / state civil register',
    reliabilityTier: 5,
    confidence: 90,
  });

  const [birthPlaceClaim, setBirthPlaceClaim] = useState<ClaimFormState>({
    value: '',
    sourceType: 'external_record',
    citation: 'County archive / civil census',
    reliabilityTier: 4,
    confidence: 85,
  });

  const [occupationClaim, setOccupationClaim] = useState<ClaimFormState>({
    value: '',
    sourceType: 'oral_testimony',
    citation: 'Family oral recollection',
    reliabilityTier: 2,
    confidence: 75,
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSourceTypeChange = (
    st: SourceType,
    setter: React.Dispatch<React.SetStateAction<ClaimFormState>>
  ) => {
    setter((prev) => ({
      ...prev,
      sourceType: st,
      reliabilityTier: SOURCE_TYPE_LABELS[st].defaultTier,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameClaim.value.trim()) {
      setError('Please provide at least a name claim for the person record.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('You must be signed in to create records');
      }

      const claimsPayload = [
        {
          attributeType: 'name',
          value: nameClaim.value.trim(),
          sourceType: nameClaim.sourceType,
          citation: nameClaim.citation.trim() || 'Primary name assertion',
          reliabilityTier: nameClaim.reliabilityTier,
          confidence: nameClaim.confidence,
        },
      ];

      if (birthDateClaim.value.trim()) {
        claimsPayload.push({
          attributeType: 'birth_date',
          value: birthDateClaim.value.trim(),
          sourceType: birthDateClaim.sourceType,
          citation: birthDateClaim.citation.trim() || 'Birth date assertion',
          reliabilityTier: birthDateClaim.reliabilityTier,
          confidence: birthDateClaim.confidence,
        });
      }

      if (birthPlaceClaim.value.trim()) {
        claimsPayload.push({
          attributeType: 'birth_place',
          value: birthPlaceClaim.value.trim(),
          sourceType: birthPlaceClaim.sourceType,
          citation: birthPlaceClaim.citation.trim() || 'Birthplace assertion',
          reliabilityTier: birthPlaceClaim.reliabilityTier,
          confidence: birthPlaceClaim.confidence,
        });
      }

      if (occupationClaim.value.trim()) {
        claimsPayload.push({
          attributeType: 'occupation',
          value: occupationClaim.value.trim(),
          sourceType: occupationClaim.sourceType,
          citation: occupationClaim.citation.trim() || 'Occupation assertion',
          reliabilityTier: occupationClaim.reliabilityTier,
          confidence: occupationClaim.confidence,
        });
      }

      const res = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isLiving,
          privacyLevel,
          ancestryStatus,
          claims: claimsPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create person');
      }

      const created = await res.json();
      onPersonCreated(created.person);
      onClose();
    } catch (err: any) {
      console.error('Error submitting person:', err);
      setError(err.message || 'An error occurred while creating the person');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <h2 className="text-xl font-bold text-stone-100 font-serif flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              <span>Create New Person Record</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Creates a core entity in PostgreSQL and attaches sourced attribute claims.
            </p>
          </div>
          <button
            id="close-create-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Database Architecture Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-200">Relational Sourced Architecture:</span>{' '}
              Attributes (name, birth date, birthplace, occupation) are saved into{' '}
              <code className="text-amber-100 font-mono">person_claim</code> with individual sources
              and reliability tiers. The <code className="text-amber-100 font-mono">person</code>{' '}
              table only retains entity identifiers, privacy, and lineage keys.
            </div>
          </div>

          {/* Section 1: Person Entity Configuration */}
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Person Entity Metadata</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Living Status
                </label>
                <select
                  id="person-is-living-select"
                  value={isLiving ? 'true' : 'false'}
                  onChange={(e) => {
                    const isLiv = e.target.value === 'true';
                    setIsLiving(isLiv);
                    if (isLiv) setPrivacyLevel('family_only');
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="true">Living (Default: Family Only Privacy)</option>
                  <option value="false">Deceased (Historical Record)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Privacy Level
                </label>
                <select
                  id="person-privacy-select"
                  value={privacyLevel}
                  onChange={(e) => setPrivacyLevel(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="family_only">Family Only (Protected)</option>
                  <option value="public">Public (Open Lineage)</option>
                  <option value="private">Private (Owner Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Ancestry Lineage Status
                </label>
                <select
                  id="person-ancestry-status-select"
                  value={ancestryStatus}
                  onChange={(e) => setAncestryStatus(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="direct_ancestor">Direct Ancestor</option>
                  <option value="collateral">Collateral Relative</option>
                  <option value="unverified">Unverified Lineage</option>
                  <option value="in_law">In-Law Branch</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Initial Sourced Claims */}
          <div className="space-y-5 pt-2 border-t border-stone-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Initial Sourced Claims</span>
            </div>

            {/* Claim 1: Name */}
            <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Full Name Claim <span className="text-amber-400">*</span></span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Tier {nameClaim.reliabilityTier} ({nameClaim.confidence}% Confidence)
                </span>
              </div>

              <input
                id="claim-name-input"
                type="text"
                required
                placeholder="e.g., Margaret Eleanor Vance"
                value={nameClaim.value}
                onChange={(e) => setNameClaim({ ...nameClaim, value: e.target.value })}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3.5 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Source Type</label>
                  <select
                    value={nameClaim.sourceType}
                    onChange={(e) => handleSourceTypeChange(e.target.value as SourceType, setNameClaim)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} (Tier {v.defaultTier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Citation / Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. 1920 State Birth Certificate No. 4920"
                    value={nameClaim.citation}
                    onChange={(e) => setNameClaim({ ...nameClaim, citation: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Claim 2: Birth Date */}
            <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>Birth Date Claim</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Tier {birthDateClaim.reliabilityTier} ({birthDateClaim.confidence}% Confidence)
                </span>
              </div>

              <input
                id="claim-birthdate-input"
                type="text"
                placeholder="e.g., 14 October 1918 or 1918-10-14"
                value={birthDateClaim.value}
                onChange={(e) => setBirthDateClaim({ ...birthDateClaim, value: e.target.value })}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3.5 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Source Type</label>
                  <select
                    value={birthDateClaim.sourceType}
                    onChange={(e) => handleSourceTypeChange(e.target.value as SourceType, setBirthDateClaim)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} (Tier {v.defaultTier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Citation</label>
                  <input
                    type="text"
                    placeholder="e.g. Parish Baptismal Record, Vol. IV"
                    value={birthDateClaim.citation}
                    onChange={(e) => setBirthDateClaim({ ...birthDateClaim, citation: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Claim 3: Birthplace */}
            <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>Birthplace Claim</span>
                </div>
                <span className="text-[11px] font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                  Tier {birthPlaceClaim.reliabilityTier} ({birthPlaceClaim.confidence}% Confidence)
                </span>
              </div>

              <input
                id="claim-birthplace-input"
                type="text"
                placeholder="e.g., Edinburgh, Midlothian, Scotland"
                value={birthPlaceClaim.value}
                onChange={(e) => setBirthPlaceClaim({ ...birthPlaceClaim, value: e.target.value })}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3.5 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Source Type</label>
                  <select
                    value={birthPlaceClaim.sourceType}
                    onChange={(e) => handleSourceTypeChange(e.target.value as SourceType, setBirthPlaceClaim)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} (Tier {v.defaultTier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Citation</label>
                  <input
                    type="text"
                    placeholder="e.g. 1921 Scottish Census Schedule"
                    value={birthPlaceClaim.citation}
                    onChange={(e) => setBirthPlaceClaim({ ...birthPlaceClaim, citation: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Claim 4: Occupation */}
            <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  <span>Occupation Claim</span>
                </div>
                <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                  Tier {occupationClaim.reliabilityTier} ({occupationClaim.confidence}% Confidence)
                </span>
              </div>

              <input
                id="claim-occupation-input"
                type="text"
                placeholder="e.g., Master Carpenter / Shipwright"
                value={occupationClaim.value}
                onChange={(e) => setOccupationClaim({ ...occupationClaim, value: e.target.value })}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3.5 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Source Type</label>
                  <select
                    value={occupationClaim.sourceType}
                    onChange={(e) => handleSourceTypeChange(e.target.value as SourceType, setOccupationClaim)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} (Tier {v.defaultTier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Citation</label>
                  <input
                    type="text"
                    placeholder="e.g. City Guild Registry / Family testimony"
                    value={occupationClaim.citation}
                    onChange={(e) => setOccupationClaim({ ...occupationClaim, citation: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-person-btn"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-stone-950 border-t-transparent animate-spin"></div>
                  <span>Writing to Cloud SQL...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Person & Insert Claims</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
