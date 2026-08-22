import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PersonRecord, SourceType, SOURCE_TYPE_LABELS } from '../types.ts';
import { X, UserPlus, ShieldAlert, Sparkles, Scroll, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface CreatePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeId: string;
  onPersonCreated: (newPerson: PersonRecord) => void;
}

export const CreatePersonModal: React.FC<CreatePersonModalProps> = ({
  isOpen,
  onClose,
  treeId,
  onPersonCreated,
}) => {
  const { getIdToken } = useAuth();

  // Basic Information
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [occupation, setOccupation] = useState('');
  const [isLiving, setIsLiving] = useState(false);
  const [ancestryStatus, setAncestryStatus] = useState<'direct_ancestor' | 'collateral' | 'unknown'>('unknown');

  // Initial Sourced Citation
  const [sourceType, setSourceType] = useState<SourceType>('certificate');
  const [citation, setCitation] = useState('Parish baptismal or civil birth registry');
  const [reliabilityTier, setReliabilityTier] = useState<number>(5);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a legal or historical name for this record.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required');

      // 1. Create the person record
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          treeId,
          isLiving,
          ancestryStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize person record');
      }

      const newPersonId = data.person.personId;

      // 2. Add initial sourced name claim
      await fetch(`/api/people/${newPersonId}/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attributeType: 'name',
          value: name.trim(),
          sourceType,
          citation: citation.trim() || 'Initial archival accession',
          reliabilityTier,
          confidence: 95,
        }),
      });

      // 3. Add birth date claim if provided
      if (birthDate.trim()) {
        await fetch(`/api/people/${newPersonId}/claims`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            attributeType: 'birth_date',
            value: birthDate.trim(),
            sourceType,
            citation: citation.trim() || 'Initial archival accession',
            reliabilityTier,
            confidence: 90,
          }),
        });
      }

      // 4. Add birth place claim if provided
      if (birthPlace.trim()) {
        await fetch(`/api/people/${newPersonId}/claims`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            attributeType: 'birth_place',
            value: birthPlace.trim(),
            sourceType,
            citation: citation.trim() || 'Initial archival accession',
            reliabilityTier,
            confidence: 85,
          }),
        });
      }

      // 5. Add occupation claim if provided
      if (occupation.trim()) {
        await fetch(`/api/people/${newPersonId}/claims`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            attributeType: 'occupation',
            value: occupation.trim(),
            sourceType,
            citation: citation.trim() || 'Initial archival accession',
            reliabilityTier,
            confidence: 80,
          }),
        });
      }

      // Fetch the fully assembled person record
      const fullRes = await fetch(`/api/people/${newPersonId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fullData = await fullRes.json();

      onPersonCreated(fullData.person || data.person);
      onClose();
    } catch (err: any) {
      console.error('Failed to register person record:', err);
      setError(err.message || 'Communication error during accession');
    } finally {
      setLoading(false);
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
              <span>PRIMARY ACCESSION PROTOCOL</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              Register New Individual Record
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

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">
              Full Legal / Historical Name <span className="text-[#D4AF37]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Margaret Eleanor Vance (née Thorne)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] font-display text-sm font-semibold"
            />
          </div>

          {/* Vital Dates & Places */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Birth Chronology / Range</label>
              <input
                type="text"
                placeholder="e.g., 1874-03-12 or Circa 1875"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Birthplace / Parish</label>
              <input
                type="text"
                placeholder="e.g., Somerset, England"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* Occupation & Direct Ancestor Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Historical Vocation / Trade</label>
              <input
                type="text"
                placeholder="e.g., Silversmith, Milliner, Cooper"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Lineage Status</label>
              <select
                value={ancestryStatus}
                onChange={(e) => setAncestryStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer font-sans"
              >
                <option value="unknown" className="bg-[#15191E]">Collateral Relative / Unspecified</option>
                <option value="direct_ancestor" className="bg-[#15191E]">Direct Ancestor (Bloodline)</option>
                <option value="collateral" className="bg-[#15191E]">Collateral Branch</option>
              </select>
            </div>
          </div>

          {/* Living Record Checkbox */}
          <div className="p-4 bg-[#120F0B] border border-[#D4AF37]/20 rounded-sm flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-display font-semibold text-[#F4EDE2] text-xs">Living Individual (Privacy Protected)</div>
              <div className="text-[11px] font-serif text-[#C4B59D] italic">
                Living records require mutual dual-consent handshake before cross-matching.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isLiving}
              onChange={(e) => setIsLiving(e.target.checked)}
              className="accent-[#D4AF37] w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Initial Provenance Citation */}
          <div className="border-t border-[#D4AF37]/20 pt-4 space-y-3">
            <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em]">
              INITIAL PRIMARY SOURCED CLAIM
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Source Document Archetype</label>
                <select
                  value={sourceType}
                  onChange={(e) => {
                    const st = e.target.value as SourceType;
                    setSourceType(st);
                    setReliabilityTier(SOURCE_TYPE_LABELS[st]?.defaultTier || 5);
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([key, info]) => (
                    <option key={key} value={key} className="bg-[#15191E]">
                      {info.label} (Tier {info.defaultTier})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Citation Archive Reference</label>
                <input
                  type="text"
                  placeholder="e.g. 1910 Federal Census, Parish Register #402..."
                  value={citation}
                  onChange={(e) => setCitation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
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
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md transition-all active:scale-95 border border-[#F3E5AB]"
            >
              {loading ? 'Registering...' : 'Register Person Dossier'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
