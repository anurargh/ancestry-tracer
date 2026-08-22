import React, { useState } from 'react';
import { SourceType, SOURCE_TYPE_LABELS, PersonRecord } from '../types.ts';
import {
  X,
  Plus,
  ShieldAlert,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { formatAttributeLabel } from '../utils/claims.ts';

interface AddClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: PersonRecord;
  initialAttributeType?: string;
  onClaimAdded: (updatedPerson: PersonRecord) => void;
  getIdToken: () => Promise<string | null>;
}

export const AddClaimModal: React.FC<AddClaimModalProps> = ({
  isOpen,
  onClose,
  person,
  initialAttributeType = 'name',
  onClaimAdded,
  getIdToken,
}) => {
  const [attributeType, setAttributeType] = useState<string>(initialAttributeType);
  const [customAttribute, setCustomAttribute] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [sourceType, setSourceType] = useState<SourceType>('certificate');
  const [citation, setCitation] = useState<string>('');
  const [reliabilityTier, setReliabilityTier] = useState<number>(5);
  const [confidence, setConfidence] = useState<number>(90);
  const [supersedeExistingActive, setSupersedeExistingActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSourceTypeChange = (st: SourceType) => {
    setSourceType(st);
    setReliabilityTier(SOURCE_TYPE_LABELS[st].defaultTier);
  };

  const finalAttributeType =
    attributeType === 'custom' ? customAttribute.trim().toLowerCase().replace(/\s+/g, '_') : attributeType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalAttributeType) {
      setError('Please select or specify an attribute type.');
      return;
    }
    if (!value.trim()) {
      setError('Please enter a claim value.');
      return;
    }
    if (!citation.trim()) {
      setError('Please provide a source citation or document reference.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/people/${person.personId}/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attributeType: finalAttributeType,
          value: value.trim(),
          sourceType,
          citation: citation.trim(),
          reliabilityTier,
          confidence,
          supersedeExistingActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit claim');
      }

      const data = await res.json();
      onClaimAdded(data.person);
      onClose();
    } catch (err: any) {
      console.error('Failed to add claim:', err);
      setError(err.message || 'An error occurred while adding the claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <h2 className="text-lg font-bold text-stone-100 font-serif flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Add or Replace Sourced Claim</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Record a new attribute assertion with citation & reliability tier.
            </p>
          </div>
          <button
            id="close-claim-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Core Rule Callout: Immutable History */}
          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Info className="w-4 h-4" />
              <span>Immutable Genealogy Audit Rule</span>
            </div>
            <p className="text-stone-400 leading-relaxed">
              In FamilyGraph, claim records are <strong className="text-stone-200">never deleted or overwritten</strong>.
              If replacing an existing value, the previous active claim will be marked as{' '}
              <code className="text-amber-200 font-mono">status = 'superseded'</code> while preserving full
              provenance in PostgreSQL.
            </p>
          </div>

          {/* Attribute Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Attribute Type
            </label>
            <select
              id="claim-attribute-select"
              value={attributeType}
              onChange={(e) => setAttributeType(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500/50"
            >
              <option value="name">Full Name (name)</option>
              <option value="birth_date">Birth Date (birth_date)</option>
              <option value="birth_place">Birthplace (birth_place)</option>
              <option value="occupation">Occupation (occupation)</option>
              <option value="death_date">Death Date (death_date)</option>
              <option value="death_place">Place of Death (death_place)</option>
              <option value="residence">Residence / Location (residence)</option>
              <option value="religion">Religion / Affiliation (religion)</option>
              <option value="custom">Other Custom Attribute...</option>
            </select>
          </div>

          {attributeType === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Custom Attribute Name
              </label>
              <input
                type="text"
                placeholder="e.g. military_rank or maiden_name"
                value={customAttribute}
                onChange={(e) => setCustomAttribute(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          )}

          {/* Value Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              Claimed Value
            </label>
            <input
              id="claim-value-input"
              type="text"
              required
              placeholder={`Enter value for ${formatAttributeLabel(finalAttributeType || 'attribute')}...`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/50 font-medium"
            />
          </div>

          {/* Source Details */}
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                Source & Evidence
              </span>
              <span className="text-xs font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                Tier {reliabilityTier} Rating
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-400 mb-1">Source Type</label>
                <select
                  id="claim-source-type-select"
                  value={sourceType}
                  onChange={(e) => handleSourceTypeChange(e.target.value as SourceType)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} (Tier {v.defaultTier})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-400 mt-1">
                  {SOURCE_TYPE_LABELS[sourceType].description}
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Confidence Score: <span className="font-mono text-amber-400">{confidence}%</span>
                </label>
                <input
                  id="claim-confidence-range"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full accent-amber-500 mt-2"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                  <span>Tentative (10%)</span>
                  <span>Definitive (100%)</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-stone-400 mb-1">
                Citation & Archive Reference <span className="text-amber-400">*</span>
              </label>
              <textarea
                id="claim-citation-textarea"
                rows={2}
                required
                placeholder="e.g. National Archives Record Group 29, 1930 Census, Roll 1042, Page 14B"
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Replacement / Superseding Mode */}
          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 flex items-start gap-3">
            <input
              id="supersede-checkbox"
              type="checkbox"
              checked={supersedeExistingActive}
              onChange={(e) => setSupersedeExistingActive(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="supersede-checkbox" className="text-xs text-stone-300 leading-relaxed cursor-pointer">
              <span className="font-semibold text-stone-100 block">
                Supersede previous active claim(s) for {formatAttributeLabel(finalAttributeType || 'attribute')}
              </span>
              <span>
                When checked, any existing active claim for this attribute will be transitioned to{' '}
                <code className="text-amber-300 font-mono">superseded</code> status. Uncheck if you wish to record this as an
                explicit co-existing conflicting claim.
              </span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-claim-btn"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-stone-950 border-t-transparent animate-spin"></div>
                  <span>Inserting Claim...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Sourced Claim</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
