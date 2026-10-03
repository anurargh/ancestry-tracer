import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PersonRecord, TreeRecord } from '../types.ts';
import { evaluatePersonClaims, formatAttributeLabel, getTierBadgeStyle } from '../utils/claims.ts';
import { PersonDetailPage } from './PersonDetailPage.tsx';
import { CreatePersonModal } from './CreatePersonModal.tsx';
import { RelationshipCalculatorModal } from './RelationshipCalculatorModal.tsx';
import {
  Users,
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  MapPin,
  Briefcase,
  ShieldCheck,
  Award,
  Layers,
  ArrowRight,
  GitBranch,
  Crown,
  Edit3,
  Eye,
  Lock,
  Globe,
  Radio,
  FileText,
  Sparkles,
  Compass,
  LayoutGrid,
  List as ListIcon,
  FolderTree,
} from 'lucide-react';

interface PeoplePageProps {
  selectedPersonId?: string | null;
  onClearSelection?: () => void;
}

export const PeoplePage: React.FC<PeoplePageProps> = ({
  selectedPersonId,
  onClearSelection,
}) => {
  const { user, getIdToken } = useAuth();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [selectedTreeFilter, setSelectedTreeFilter] = useState<string>('all');
  const [activePerson, setActivePerson] = useState<PersonRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [livingFilter, setLivingFilter] = useState<'all' | 'living' | 'deceased'>('all');
  const [ancestryFilter, setAncestryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'ledger' | 'cards'>('ledger');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [calcModalOpen, setCalcModalOpen] = useState<boolean>(false);
  const [calcInitialA, setCalcInitialA] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLoadPrestoredDatabase = async (cleanExisting = false) => {
    try {
      setSeeding(true);
      setError(null);
      setSuccessMsg(null);
      const token = await getIdToken();
      const res = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cleanExisting,
          targetUid: user?.uid,
          targetEmail: user?.email,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load pre-stored dataset');
      }
      const data = await res.json();
      setSuccessMsg(data.message || 'Pre-stored archive (44 individuals) connected successfully!');
      await fetchPeopleAndTrees(false);
    } catch (err: any) {
      console.error('Error loading pre-stored database:', err);
      setError(err.message || 'Failed to load pre-stored database');
    } finally {
      setSeeding(false);
    }
  };

  const fetchPeopleAndTrees = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const token = await getIdToken();
      if (!token) return;

      const [peopleRes, treesRes] = await Promise.all([
        fetch('/api/people', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/trees', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!peopleRes.ok) {
        throw new Error('Failed to fetch people records');
      }

      const peopleData = await peopleRes.json();
      const freshPeople = peopleData.people || [];

      setPeople((prevPeople) => {
        const prevMap = new Map<string, PersonRecord>(prevPeople.map((p) => [p.personId, p]));
        return freshPeople.map((p: PersonRecord) => {
          const prev = prevMap.get(p.personId);
          return {
            ...p,
            parents: p.parents ?? prev?.parents,
            children: p.children ?? prev?.children,
            partnerships: p.partnerships ?? prev?.partnerships,
          };
        });
      });

      if (treesRes.ok) {
        const treesData = await treesRes.json();
        setTrees(treesData.trees || []);
      }
    } catch (err: any) {
      console.error('Error loading people registry:', err);
      setError(err.message || 'Error loading records');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeopleAndTrees();
  }, [user]);

  // Sync selectedPersonId prop
  useEffect(() => {
    if (selectedPersonId && people.length > 0) {
      const match = people.find((p) => p.personId === selectedPersonId);
      if (match && activePerson?.personId !== match.personId) {
        setActivePerson(match);
      }
    }
  }, [selectedPersonId, people, activePerson?.personId]);

  const handleSelectPerson = (person: PersonRecord) => {
    setActivePerson(person);
  };

  const handleBackToList = () => {
    setActivePerson(null);
    if (onClearSelection) onClearSelection();
    fetchPeopleAndTrees(false);
  };

  const handlePersonUpdated = (updatedPerson: PersonRecord) => {
    setPeople((prev) => {
      const exists = prev.some((p) => p.personId === updatedPerson.personId);
      if (exists) {
        return prev.map((p) => (p.personId === updatedPerson.personId ? updatedPerson : p));
      }
      return [updatedPerson, ...prev];
    });
    setActivePerson((prev) => (prev?.personId === updatedPerson.personId ? updatedPerson : prev));
  };

  // Filter people
  const filteredPeople = people.filter((person) => {
    const evaluation = evaluatePersonClaims(person.claims || []);
    const nameClaim = evaluation['name']?.bestClaims[0]?.value || '';
    const birthPlace = evaluation['birth_place']?.bestClaims[0]?.value || '';
    const occupation = evaluation['occupation']?.bestClaims[0]?.value || '';

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = nameClaim.toLowerCase().includes(q);
      const matchPlace = birthPlace.toLowerCase().includes(q);
      const matchOcc = occupation.toLowerCase().includes(q);
      const matchId = person.personId.toLowerCase().includes(q);
      if (!matchName && !matchPlace && !matchOcc && !matchId) return false;
    }

    // Living filter
    if (livingFilter === 'living' && !person.isLiving) return false;
    if (livingFilter === 'deceased' && person.isLiving) return false;

    // Tree filter
    if (selectedTreeFilter !== 'all' && person.treeId !== selectedTreeFilter) {
      return false;
    }

    // Ancestry status filter
    if (ancestryFilter !== 'all' && person.ancestryStatus !== ancestryFilter) {
      return false;
    }

    return true;
  });

  if (activePerson) {
    return (
      <PersonDetailPage
        person={activePerson}
        onBack={handleBackToList}
        onPersonUpdated={handlePersonUpdated}
        onSelectPerson={(pid) => {
          const target = people.find((p) => p.personId === pid);
          if (target) {
            setActivePerson(target);
          } else {
            setActivePerson({ personId: pid } as PersonRecord);
          }
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full max-w-full overflow-hidden">
      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-3.5 bg-[#0A1A12] border border-[#34D399]/60 text-xs text-[#A7F3D0] flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#34D399] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-[#A7F3D0] hover:text-white text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-[#C5A059]/30 pb-7">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#C5A059] uppercase tracking-[0.25em]">
            <span>❖ PEOPLE DIRECTORY</span>
            <span className="text-[#6E675C]">•</span>
            <span>RECORDS</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-deco font-bold text-[#F5DE98] tracking-wide">
            People & Family Members
          </h1>
          <p className="text-sm text-[#E8DFD0]/80 font-reading max-w-xl">
            Search and manage individual family members, track vital details, and link supporting records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="load-demo-data-btn"
            onClick={() => handleLoadPrestoredDatabase(people.length > 0)}
            disabled={seeding}
            title="Load or refresh curated 44-individual family tree with cross-tree lineages and duplicate pairs"
            className="inline-flex items-center gap-2 bg-[#101724] hover:bg-[#182335] text-[#F5DE98] border border-[#C5A059]/50 hover:border-[#C5A059] px-3.5 py-2.5 text-xs font-deco font-semibold tracking-wider transition-colors shadow-sm disabled:opacity-50"
          >
            {seeding ? (
              <div className="w-3.5 h-3.5 border-2 border-[#C5A059] border-t-transparent animate-spin rounded-full" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
            )}
            <span>{seeding ? 'CONNECTING ARCHIVE...' : people.length > 0 ? 'RELOAD ARCHIVE' : 'LOAD PRE-STORED ARCHIVE'}</span>
          </button>

          <button
            id="open-kinship-calc-btn"
            onClick={() => {
              setCalcInitialA(null);
              setCalcModalOpen(true);
            }}
            className="inline-flex items-center gap-2.5 bg-[#0D1219] hover:bg-[#131A24] text-[#F5DE98] border border-[#C5A059]/40 hover:border-[#C5A059] px-4 py-2.5 text-xs font-deco font-semibold tracking-wider transition-colors shadow-sm"
          >
            <Compass className="w-4 h-4 text-[#C5A059]" />
            <span>CALCULATE RELATIONSHIP</span>
          </button>

          <button
            id="create-person-btn"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#C5A059] via-[#E2BA6E] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold tracking-wider px-5 py-2.5 text-xs transition-all shadow-[0_0_15px_rgba(197,160,89,0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#07090D]" />
            <span>ADD PERSON</span>
          </button>
        </div>
      </div>

      {/* Art Deco Filter and Search Chamber */}
      <div className="bg-[#0A0E15] border border-[#C5A059]/30 p-5 space-y-4 shadow-lg deco-corner-accent">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search box with brass border */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#C5A059] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="search-people-input"
              type="text"
              placeholder="Search by name, birthplace, occupation, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#07090D] border border-[#222B38] focus:border-[#C5A059] text-xs text-[#F5DE98] placeholder:text-[#6E675C] focus:outline-none font-sans transition-colors"
            />
          </div>

          {/* Filter options */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Tree Selector */}
            {trees.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#07090D] border border-[#222B38] px-3 py-1.5">
                <FolderTree className="w-3.5 h-3.5 text-[#C5A059]" />
                <select
                  value={selectedTreeFilter}
                  onChange={(e) => setSelectedTreeFilter(e.target.value)}
                  className="bg-transparent text-[#F5DE98] focus:outline-none cursor-pointer text-xs pr-1 font-deco"
                >
                  <option value="all" className="bg-[#0D1219]">All Trees ({trees.length})</option>
                  {trees.map((t) => (
                    <option key={t.treeId} value={t.treeId} className="bg-[#0D1219]">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Vitality Status */}
            <div className="flex items-center gap-1.5 bg-[#07090D] border border-[#222B38] px-3 py-1.5">
              <span className="text-[#A89F91] font-mono text-[11px]">Status:</span>
              <select
                value={livingFilter}
                onChange={(e) => setLivingFilter(e.target.value as any)}
                className="bg-transparent text-[#F5DE98] focus:outline-none cursor-pointer text-xs pr-1 font-sans"
              >
                <option value="all" className="bg-[#0D1219]">All Statuses</option>
                <option value="living" className="bg-[#0D1219]">Living Only</option>
                <option value="deceased" className="bg-[#0D1219]">Deceased Only</option>
              </select>
            </div>

            {/* Lineage Role */}
            <div className="flex items-center gap-1.5 bg-[#07090D] border border-[#222B38] px-3 py-1.5">
              <span className="text-[#A89F91] font-mono text-[11px]">Lineage:</span>
              <select
                value={ancestryFilter}
                onChange={(e) => setAncestryFilter(e.target.value)}
                className="bg-transparent text-[#F5DE98] focus:outline-none cursor-pointer text-xs pr-1 font-sans"
              >
                <option value="all" className="bg-[#0D1219]">All Lineages</option>
                <option value="direct_ancestor" className="bg-[#0D1219]">Direct Ancestors</option>
                <option value="collateral" className="bg-[#0D1219]">Collateral Lines</option>
                <option value="in_law" className="bg-[#0D1219]">In-laws & Spouses</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-[#222B38] bg-[#07090D] p-0.5">
              <button
                onClick={() => setViewMode('ledger')}
                title="Table View"
                className={`p-1.5 transition-colors ${
                  viewMode === 'ledger'
                    ? 'bg-[#131A24] text-[#F5DE98] border border-[#C5A059]/40'
                    : 'text-[#6E675C] hover:text-[#E8DFD0]'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                title="Cards View"
                className={`p-1.5 transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-[#131A24] text-[#F5DE98] border border-[#C5A059]/40'
                    : 'text-[#6E675C] hover:text-[#E8DFD0]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Metrics */}
        <div className="flex items-center justify-between text-[10px] text-[#A89F91] font-mono pt-2 border-t border-[#222B38]">
          <span>
            PEOPLE FOUND: <strong className="text-[#F5DE98]">{filteredPeople.length}</strong> of{' '}
            {people.length}
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#C5A059] hover:underline"
            >
              Clear search filter
            </button>
          )}
        </div>
      </div>

      {/* Main Records Presentation */}
      {loading ? (
        <div className="py-28 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#222B38] border-t-[#C5A059] animate-spin mx-auto"></div>
          <p className="text-xs font-mono tracking-widest text-[#A89F91] uppercase">Loading people records...</p>
        </div>
      ) : error ? (
        <div className="p-5 border border-[#5E1D31] bg-[#240B13] text-[#F5DE98] text-xs font-mono">
          {error}
        </div>
      ) : people.length === 0 ? (
        <div className="py-16 text-center border-2 border-[#C5A059]/40 p-8 bg-[#0B0F17] space-y-4 shadow-[0_0_40px_rgba(197,160,89,0.1)] deco-corner-accent">
          <div className="w-12 h-12 border border-[#C5A059] bg-[#121924] flex items-center justify-center text-[#F5DE98] mx-auto rotate-45 shadow-sm mb-2">
            <Sparkles className="w-6 h-6 -rotate-45 text-[#C5A059]" />
          </div>
          <h3 className="text-xl font-deco font-bold text-[#F5DE98]">
            Pre-stored Genealogical Database Available
          </h3>
          <p className="text-xs text-[#C5BBAE] max-w-lg mx-auto font-reading leading-relaxed">
            The database currently has no records. You can load the pre-stored archival dataset containing <strong className="text-white">44 documented individuals</strong> across 4 generations, complete with multi-tree lineages, vital certificates, census records, and duplicate detection candidates.
          </p>

          <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
            <button
              id="empty-load-archive-btn"
              onClick={() => handleLoadPrestoredDatabase(false)}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#C5A059] to-[#E3C37A] hover:from-[#D4AF67] hover:to-[#F5DE98] text-[#07090D] font-deco font-bold px-6 py-2.5 text-xs transition-all shadow-md disabled:opacity-50 tracking-wider uppercase"
            >
              {seeding ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#07090D] border-t-transparent animate-spin rounded-full" />
                  <span>LOADING PRE-STORED ARCHIVE...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#07090D]" />
                  <span>LOAD PRE-STORED DATABASE (44 RECORDS)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 border border-[#C5A059]/50 hover:border-[#C5A059] text-[#EDE7DF] hover:bg-[#141B26] font-deco font-semibold px-4 py-2.5 text-xs transition-all tracking-wider uppercase"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span>START EMPTY (ADD PERSON)</span>
            </button>
          </div>
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="py-20 text-center border border-[#222B38] p-10 bg-[#0A0E15] space-y-4 deco-corner-accent">
          <FileText className="w-12 h-12 text-[#6E675C] mx-auto mb-2" />
          <h3 className="text-lg font-deco font-bold text-[#F5DE98]">
            No People Found
          </h3>
          <p className="text-xs text-[#A89F91] max-w-md mx-auto font-reading">
            Try adjusting your search criteria or add a new person to your family tree.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 bg-[#C5A059] text-[#07090D] font-deco font-bold px-5 py-2 text-xs transition-all shadow-md"
          >
            <Plus className="w-4 h-4 text-[#07090D]" />
            <span>ADD PERSON</span>
          </button>
        </div>
      ) : viewMode === 'ledger' ? (
        /* Ledger Table View */
        <div className="border border-[#C5A059]/30 bg-[#0A0E15] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07090D] border-b border-[#C5A059]/30 text-[#C5A059] font-deco uppercase text-[10px] tracking-[0.15em]">
                  <th className="py-4 px-5">ID</th>
                  <th className="py-4 px-5">NAME</th>
                  <th className="py-4 px-5">BIRTH DATE</th>
                  <th className="py-4 px-5">BIRTHPLACE</th>
                  <th className="py-4 px-5">STATUS</th>
                  <th className="py-4 px-5">SOURCES</th>
                  <th className="py-4 px-5 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222B38]">
                {filteredPeople.map((person, idx) => {
                  const evaluation = evaluatePersonClaims(person.claims || []);
                  const nameEval = evaluation['name'];
                  const birthDateEval = evaluation['birth_date'];
                  const birthPlaceEval = evaluation['birth_place'];

                  const displayName = nameEval?.bestClaims[0]?.value || 'Unnamed Individual';
                  const birthDate = birthDateEval?.bestClaims[0]?.value || '—';
                  const birthPlace = birthPlaceEval?.bestClaims[0]?.value || '—';
                  const bestTier = nameEval?.bestClaims[0]?.source?.reliabilityTier || 3;

                  const recordFolio = `REC-${String(idx + 1).padStart(4, '0')}`;

                  return (
                    <tr
                      key={person.personId}
                      onClick={() => handleSelectPerson(person)}
                      className="hover:bg-[#131A24] cursor-pointer transition-all group"
                    >
                      {/* Record Folio & UUID */}
                      <td className="py-4 px-5 font-mono">
                        <div className="text-xs text-[#F5DE98] font-bold">
                          {recordFolio}
                        </div>
                        <div className="text-[9px] text-[#6E675C] tracking-wider">
                          {person.personId.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Display Name */}
                      <td className="py-4 px-5">
                        <div className="font-deco font-bold text-sm text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                          {displayName}
                        </div>
                        {nameEval?.hasTies && (
                          <div className="text-[10px] text-[#D9658B] font-mono flex items-center gap-1 mt-0.5">
                            <span>⚠ Competing Claims ({nameEval.activeClaims.length})</span>
                          </div>
                        )}
                      </td>

                      {/* Birth Date */}
                      <td className="py-4 px-5 text-[#E8DFD0] font-sans">
                        {birthDate}
                      </td>

                      {/* Birthplace */}
                      <td className="py-4 px-5 text-[#A89F91] max-w-[200px] truncate font-reading">
                        {birthPlace}
                      </td>

                      {/* Vitality & Lineage Status */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {person.isLiving ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-[#1D5C4A] bg-[#0B221B] text-[#52B395]">
                              <span className="w-1.5 h-1.5 bg-[#52B395] rounded-full"></span>
                              LIVING
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-[#222B38] bg-[#07090D] text-[#A89F91]">
                              DECEASED
                            </span>
                          )}

                          {person.ancestryStatus === 'direct_ancestor' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-[#C5A059]/40 bg-[#0D1219] text-[#F5DE98]">
                              DIRECT ANCESTOR
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Provenance Tier */}
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#A89F91]">
                          <Award className="w-3.5 h-3.5 text-[#C5A059]" />
                          Tier {bestTier}/5
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#C5A059] font-deco font-semibold tracking-wider group-hover:translate-x-1 transition-transform">
                          <span>VIEW</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Archival Dossier Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPeople.map((person, idx) => {
            const evaluation = evaluatePersonClaims(person.claims || []);
            const nameEval = evaluation['name'];
            const birthDateEval = evaluation['birth_date'];
            const birthPlaceEval = evaluation['birth_place'];
            const occEval = evaluation['occupation'];

            const displayName = nameEval?.bestClaims[0]?.value || 'Unnamed Individual';
            const birthDate = birthDateEval?.bestClaims[0]?.value || 'Date unrecorded';
            const birthPlace = birthPlaceEval?.bestClaims[0]?.value || 'Place unrecorded';
            const occupation = occEval?.bestClaims[0]?.value || null;
            const recordFolio = `REC-${String(idx + 1).padStart(4, '0')}`;

            return (
              <div
                key={person.personId}
                onClick={() => handleSelectPerson(person)}
                className="group cursor-pointer bg-[#0A0E15] border border-[#222B38] hover:border-[#C5A059] p-6 space-y-5 transition-all shadow-md relative flex flex-col justify-between deco-corner-accent hover:-translate-y-1"
              >
                <div>
                  {/* Top Stamped Folio Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#222B38]">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-[#F5DE98] font-bold bg-[#07090D] px-2 py-0.5 border border-[#C5A059]/40">
                        {recordFolio}
                      </span>
                      <span className="text-[9px] font-mono text-[#6E675C]">
                        #{person.personId.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {person.isLiving ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-[#1D5C4A] bg-[#0B221B] text-[#52B395]">
                          LIVING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-[#222B38] bg-[#07090D] text-[#A89F91]">
                          DECEASED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="mt-4 space-y-1">
                    <h3 className="text-base font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors leading-tight">
                      {displayName}
                    </h3>
                    {person.ancestryStatus === 'direct_ancestor' && (
                      <div className="text-[10px] text-[#C5A059] font-mono uppercase tracking-wider">
                        ✦ Direct Ancestor Line
                      </div>
                    )}
                  </div>

                  {/* Primary Attributes Ledger */}
                  <div className="mt-4 space-y-2.5 text-xs text-[#A89F91]">
                    <div className="flex items-start gap-2.5">
                      <Calendar className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                      <span className="text-[#E8DFD0]">{birthDate}</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                      <span className="truncate font-reading">{birthPlace}</span>
                    </div>
                    {occupation && (
                      <div className="flex items-start gap-2.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                        <span className="truncate font-reading">{occupation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-4 border-t border-[#222B38] flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-[#6E675C]">
                    {person.claims?.length || 0} facts documented
                  </span>
                  <span className="text-xs font-deco font-semibold text-[#C5A059] flex items-center gap-1.5 group-hover:translate-x-1 transition-transform tracking-wider">
                    <span>VIEW</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {createModalOpen && (
        <CreatePersonModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onPersonCreated={(newPerson) => {
            setPeople((prev) => [newPerson, ...prev]);
            setActivePerson(newPerson);
          }}
          getIdToken={getIdToken}
        />
      )}

      {calcModalOpen && (
        <RelationshipCalculatorModal
          isOpen={calcModalOpen}
          onClose={() => setCalcModalOpen(false)}
          initialPersonAId={calcInitialA}
          onSelectPerson={(pid) => {
            const target = people.find((p) => p.personId === pid);
            if (target) {
              setCalcModalOpen(false);
              setActivePerson(target);
            }
          }}
        />
      )}
    </div>
  );
};

