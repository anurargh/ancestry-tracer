import React, { useState } from 'react';
import { SourceType, SOURCE_TYPE_LABELS, PersonRecord } from '../types.ts';
import {
  X,
  Plus,
  ShieldAlert,
  Info,
  CheckCircle2,
  Award,
  Scroll,
} from 'lucide-react';
import { motion } from 'motion/react';
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
      setError('Please select or specify an evidentiary attribute type.');
      return;
    }
    if (!value.trim()) {
      setError('Please enter an evidentiary claim assertion value.');
      return;
    }
    if (!citation.trim()) {
      setError('Please provide an archival source citation or document reference.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required');

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
        throw new Error(data.error || 'Failed to seal evidentiary claim');
      }

      const data = await res.json();
      onClaimAdded(data.person);
      onClose();
    } catch (err: any) {
      console.error('Failed to add claim:', err);
      setError(err.message || 'An error occurred while sealing the claim assertion');
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
              <span>EVIDENTIAL ASSERTION REGISTRY</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              Record Sourced Claim Assertion
            </h2>
          </div>
          <button
            id="close-claim-modal-btn"
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

          {/* Core Rule Callout */}
          <div className="p-3.5 rounded-sm bg-[#120F0B] border border-[#D4AF37]/30 text-[#C4B59D] space-y-1">
            <div className="flex items-center gap-2 font-display uppercase tracking-wider text-[11px] text-[#D4AF37] font-semibold">
              <Info className="w-3.5 h-3.5" />
              <span>Immutable Claim Provenance Guarantee</span>
            </div>
            <p className="text-[11px] font-serif leading-relaxed italic">
              FamilyGraph never mutates past claims. New assertions are inserted with timestamped reliability scores, ensuring the audit ledger retains an untampered historical chronology.
            </p>
          </div>

          {/* Attribute Selection */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Genealogical Attribute Dimension</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['name', 'birth_date', 'birth_place', 'occupation', 'custom'].map((attr) => (
                <button
                  key={attr}
                  type="button"
                  onClick={() => setAttributeType(attr)}
                  className={`py-2 px-2.5 rounded-sm border text-center font-mono capitalize text-xs transition-all ${
                    attributeType === attr
                      ? 'border-[#D4AF37] bg-gradient-to-b from-[#1C1A14] to-[#120F0B] text-[#D4AF37] font-bold shadow-sm ring-1 ring-[#D4AF37]/40'
                      : 'border-[#2B333C] bg-[#101317] text-[#8C8275] hover:text-[#F4EDE2] hover:border-[#D4AF37]/30'
                  }`}
                >
                  {formatAttributeLabel(attr)}
                </button>
              ))}
            </div>

            {attributeType === 'custom' && (
              <input
                type="text"
                placeholder="Custom attribute (e.g., military_rank, title, religion)..."
                value={customAttribute}
                onChange={(e) => setCustomAttribute(e.target.value)}
                className="w-full mt-2 px-3.5 py-2 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
              />
            )}
          </div>

          {/* Claim Value */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Claim Assertion Value</label>
            <input
              type="text"
              required
              placeholder="e.g. William Arthur Pendelton, 14 May 1882, Blacksmith"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] font-display text-sm font-semibold"
            />
          </div>

          {/* Source Type & Tier Selector */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Source Document Archetype</label>
            <select
              value={sourceType}
              onChange={(e) => handleSourceTypeChange(e.target.value as SourceType)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
            >
              {Object.entries(SOURCE_TYPE_LABELS).map(([key, info]) => (
                <option key={key} value={key} className="bg-[#15191E]">
                  {info.label} — Tier {info.defaultTier} ({info.description})
                </option>
              ))}
            </select>
          </div>

          {/* Citation Reference */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Citation / Archival Dossier Reference</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. 1900 US Federal Census, District 4, Page 12B, Roll 442, Family Line 18..."
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Reliability Tier & Confidence Sliders */}
          <div className="grid grid-cols-2 gap-4 bg-[#101317] p-4 rounded-sm border border-[#D4AF37]/20">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#8C8275]">Reliability Tier:</span>
                <span className="text-[#D4AF37] font-bold">Tier {reliabilityTier}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={reliabilityTier}
                onChange={(e) => setReliabilityTier(Number(e.target.value))}
                className="w-full accent-[#D4AF37] cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#8C8275]">Confidence:</span>
                <span className="text-[#85C49F] font-bold">{confidence}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full accent-[#4C7A5E] cursor-pointer"
              />
            </div>
          </div>

          {/* Supersede Toggle */}
          <div className="flex items-center gap-3 p-3 bg-[#120F0B] border border-[#D4AF37]/20 rounded-sm">
            <input
              type="checkbox"
              id="supersede-check"
              checked={supersedeExistingActive}
              onChange={(e) => setSupersedeExistingActive(e.target.checked)}
              className="accent-[#D4AF37] w-4 h-4 cursor-pointer"
            />
            <label htmlFor="supersede-check" className="text-[#F4EDE2] font-serif text-xs cursor-pointer">
              Supersede existing active assertions for this attribute dimension
            </label>
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
              {isSubmitting ? 'Archiving...' : 'Seal Sourced Assertion'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
