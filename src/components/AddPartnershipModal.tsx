import React, { useState, useEffect } from 'react';
import {
  PersonRecord,
  PartnershipUnionType,
  UNION_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  SourceType,
} from '../types.ts';
import { evaluatePersonClaims } from '../utils/claims.ts';
import {
  X,
  Heart,
  ShieldCheck,
  Search,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

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
  const [loadingPeople, setLoadingPeople] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [unionType, setUnionType] = useState<PartnershipUnionType>('marriage');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Provenance / Source inputs
  const [sourceType, setSourceType] = useState<SourceType>('certificate');
  const [citation, setCitation] = useState<string>('');
  const [reliabilityTier, setReliabilityTier] = useState<number>(5);

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentPersonEval = evaluatePersonClaims(currentPerson.claims || []);
  const currentPersonName =
    currentPersonEval['name']?.bestClaims[0]?.value || `Person (${currentPerson.personId.slice(0, 8)})`;

  // Fetch all people in the registry
  useEffect(() => {
    if (!isOpen) return;
    const fetchAllPeople = async () => {
      setLoadingPeople(true);
      try {
        const token = await getIdToken();
        const res = await fetch('/api/people', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out current person and existing partners
          const existingPartnerIds = new Set(
            (currentPerson.partnerships || []).map((p) => p.partner.personId)
          );
          const list: PersonRecord[] = (data.people || []).filter(
            (p: PersonRecord) =>
              p.personId !== currentPerson.personId && !existingPartnerIds.has(p.personId)
          );
          setPeople(list);
        }
      } catch (err) {
        console.error('Failed to fetch people for partnership modal:', err);
      } finally {
        setLoadingPeople(false);
      }
    };

    fetchAllPeople();
  }, [isOpen, currentPerson.personId, currentPerson.partnerships]);

  const handleSourceTypeChange = (newType: SourceType) => {
    setSourceType(newType);
    setReliabilityTier(SOURCE_TYPE_LABELS[newType]?.defaultTier || 4);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId) {
      setError('Please select a partner from the registry.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/relationships/partnership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          person1Id: currentPerson.personId,
          person2Id: selectedPartnerId,
          unionType,
          startDate: startDate.trim() || undefined,
          endDate: endDate.trim() || undefined,
          sourceType,
          citation: citation.trim() || undefined,
          reliabilityTier: Number(reliabilityTier),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save partnership.');
      }

      onPartnershipAdded();
      onClose();
    } catch (err: any) {
      console.error('Error creating partnership:', err);
      setError(err.message || 'Failed to save partnership.');
    } finally {
      setSaving(false);
    }
  };

  // Filter people by query
  const filteredPeople = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const evalData = evaluatePersonClaims(p.claims || []);
    const name = evalData['name']?.bestClaims[0]?.value?.toLowerCase() || '';
    const birth = evalData['birth_date']?.bestClaims[0]?.value?.toLowerCase() || '';
    const place = evalData['birth_place']?.bestClaims[0]?.value?.toLowerCase() || '';
    return name.includes(q) || birth.includes(q) || place.includes(q) || p.personId.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100 font-serif">
                Link Spouse or Partner
              </h2>
              <p className="text-xs text-stone-400">
                Record a union between <strong className="text-pink-300">{currentPersonName}</strong> and an existing person.
              </p>
            </div>
          </div>

          <button
            id="close-partnership-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Partner Picker */}
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold">
              1. Select Partner from Registry
            </label>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="text"
                placeholder="Search registry by name, birth year, or place..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* List */}
            <div className="max-h-44 overflow-y-auto space-y-1.5 p-1 rounded-xl bg-stone-950/70 border border-stone-800">
              {loadingPeople ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  Loading registry records...
                </div>
              ) : filteredPeople.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  No unpartnered individuals available in registry.
                </div>
              ) : (
                filteredPeople.map((p) => {
                  const evalData = evaluatePersonClaims(p.claims || []);
                  const name = evalData['name']?.bestClaims[0]?.value || 'Unnamed Person';
                  const birth = evalData['birth_date']?.bestClaims[0]?.value;
                  const isSelected = selectedPartnerId === p.personId;

                  return (
                    <div
                      key={p.personId}
                      id={`select-partner-${p.personId}`}
                      onClick={() => setSelectedPartnerId(p.personId)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-pink-500/15 border-pink-500/60 text-pink-200 shadow-sm'
                          : 'bg-stone-900/80 border-stone-850 hover:bg-stone-850 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-pink-400 bg-pink-400 text-stone-950'
                              : 'border-stone-600 bg-stone-800'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                        </div>
                        <div>
                          <span className="font-semibold text-stone-100 font-serif">{name}</span>
                          {birth && <span className="text-stone-400 ml-2">(Born: {birth})</span>}
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-stone-500">
                        {p.personId.slice(0, 8)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: Union Type */}
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold">
              2. Union Type
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  'marriage',
                  'civil_union',
                  'domestic_partnership',
                  'common_law',
                  'informal',
                ] as PartnershipUnionType[]
              ).map((type) => {
                const isSelected = unionType === type;
                const info = UNION_TYPE_LABELS[type];

                return (
                  <button
                    key={type}
                    type="button"
                    id={`union-type-${type}-btn`}
                    onClick={() => setUnionType(type)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-pink-500/10 border-pink-500/60 text-pink-200 shadow-sm'
                        : 'bg-stone-950 border-stone-800 hover:bg-stone-850 text-stone-400'
                    }`}
                  >
                    <div className="font-semibold text-xs text-stone-200">{info.label}</div>
                    <div className="text-[10px] text-stone-500 leading-tight mt-0.5 line-clamp-1">
                      {info.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Dates */}
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold">
              3. Union Dates (Optional)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Start Date / Marriage Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="e.g. 1912-06-15 or 1912"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  End Date / Dissolution (if applicable)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="e.g. 1954-11-20 or 1954"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Provenance & Source Citation */}
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400 font-mono">
              <ShieldCheck className="w-4 h-4" />
              <span>4. Provenance & Marriage Certificate Citation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Source Document Type
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => handleSourceTypeChange(e.target.value as SourceType)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label} (Tier {item.defaultTier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Reliability Rating (Tier 1–5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={reliabilityTier}
                  onChange={(e) => setReliabilityTier(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 font-mono focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">
                Citation & Archive Reference
              </label>
              <textarea
                rows={2}
                placeholder="e.g. County Marriage License #1920-44, Church Parish Register Vol. 3..."
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-800">
            <button
              type="button"
              id="cancel-partnership-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="submit-partnership-btn"
              disabled={saving || !selectedPartnerId}
              className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95"
            >
              <Heart className="w-4 h-4" />
              <span>{saving ? 'Saving Partnership...' : 'Save Partnership'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
