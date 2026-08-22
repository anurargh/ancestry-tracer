import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  Search,
  Filter,
  Plus,
  Database,
  Lock,
  Sparkles,
  Info,
  Clock,
  UserCheck,
  User,
  Calendar,
  MapPin,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  Layers,
  Award,
} from 'lucide-react';
import { PersonRecord } from '../types.ts';
import { evaluatePersonClaims, getTierBadgeStyle } from '../utils/claims.ts';
import { CreatePersonModal } from './CreatePersonModal.tsx';
import { PersonDetailPage } from './PersonDetailPage.tsx';
import { RelationshipCalculatorModal } from './RelationshipCalculatorModal.tsx';
import { Compass } from 'lucide-react';

interface PeoplePageProps {
  selectedPersonId?: string | null;
  onSelectPersonId?: (id: string | null) => void;
}

export const PeoplePage: React.FC<PeoplePageProps> = ({
  selectedPersonId: propSelectedPersonId,
  onSelectPersonId,
}) => {
  const { user, dbUser, signInWithGoogle, getIdToken } = useAuth();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMerged, setShowMerged] = useState<boolean>(false);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState<boolean>(false);
  const [activePerson, setActivePerson] = useState<PersonRecord | null>(null);

  const fetchPeople = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getIdToken();
      const url = showMerged ? '/api/people?includeMerged=true' : '/api/people';
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPeople(data.people || []);

        // If a person was selected, update their latest object
        if (activePerson) {
          const fresh = (data.people || []).find(
            (p: PersonRecord) => p.personId === activePerson.personId
          );
          if (fresh) setActivePerson(fresh);
        }
      }
    } catch (err) {
      console.error('Failed to fetch people:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [user, showMerged]);

  // Handle prop-driven selection
  useEffect(() => {
    if (propSelectedPersonId && people.length > 0) {
      const found = people.find((p) => p.personId === propSelectedPersonId);
      if (found) setActivePerson(found);
    }
  }, [propSelectedPersonId, people]);

  const handleSelectPerson = (person: PersonRecord) => {
    setActivePerson(person);
    if (onSelectPersonId) onSelectPersonId(person.personId);
  };

  const handleBackToList = () => {
    setActivePerson(null);
    if (onSelectPersonId) onSelectPersonId(null);
    fetchPeople();
  };

  const handlePersonCreated = (newPerson: PersonRecord) => {
    setPeople((prev) => [newPerson, ...prev]);
    setActivePerson(newPerson);
    if (onSelectPersonId) onSelectPersonId(newPerson.personId);
  };

  const handlePersonUpdated = (updatedPerson: PersonRecord) => {
    setPeople((prev) =>
      prev.map((p) => (p.personId === updatedPerson.personId ? updatedPerson : p))
    );
    setActivePerson(updatedPerson);
  };

  // If a person is selected, show detail view
  if (activePerson) {
    return (
      <PersonDetailPage
        person={activePerson}
        onBack={handleBackToList}
        onPersonUpdated={handlePersonUpdated}
        onSelectPerson={async (targetPersonId: string) => {
          const found = people.find((p) => p.personId === targetPersonId);
          if (found) {
            setActivePerson(found);
            if (onSelectPersonId) onSelectPersonId(found.personId);
          } else {
            // Fetch fresh
            try {
              const token = await getIdToken();
              const res = await fetch(`/api/people/${targetPersonId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const data = await res.json();
                setActivePerson(data.person);
                if (onSelectPersonId) onSelectPersonId(data.person.personId);
              }
            } catch (err) {
              console.error('Failed to load target person:', err);
            }
          }
        }}
      />
    );
  }

  // Filtered list
  const filteredPeople = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const evalData = evaluatePersonClaims(p.claims || []);

    const name = evalData['name']?.bestClaims[0]?.value?.toLowerCase() || '';
    const birthplace = evalData['birth_place']?.bestClaims[0]?.value?.toLowerCase() || '';
    const occupation = evalData['occupation']?.bestClaims[0]?.value?.toLowerCase() || '';
    const birthdate = evalData['birth_date']?.bestClaims[0]?.value?.toLowerCase() || '';

    return (
      name.includes(query) ||
      birthplace.includes(query) ||
      occupation.includes(query) ||
      birthdate.includes(query)
    );
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-950 text-stone-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1">
              <Database className="w-3.5 h-3.5" />
              <span>PostgreSQL Core Schema</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-100 font-serif">
              People Registry
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Individual person entity nodes with sourced, multi-claim attribute assertions in PostgreSQL.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  id="people-kinship-calc-btn"
                  onClick={() => setCalculatorModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-stone-850 hover:bg-stone-800 text-amber-300 border border-amber-500/30 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm active:scale-95"
                >
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>How are they related?</span>
                </button>

                <button
                  id="add-person-btn"
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Person</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {!user ? (
          /* Sign-in Callout when logged out */
          <div className="p-8 rounded-2xl bg-stone-900 border border-stone-800 text-center max-w-xl mx-auto my-12 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-stone-100 mb-2">
              Sign In to Access Your Registry
            </h2>
            <p className="text-sm text-stone-400 mb-6 leading-relaxed">
              Connect with Firebase Authentication to access your private PostgreSQL-backed
              genealogical records, person profiles, and sourced attribute claims.
            </p>
            <button
              id="people-signin-btn"
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm active:scale-95"
            >
              <UserCheck className="w-4 h-4" />
              <span>Sign in with Google</span>
            </button>
          </div>
        ) : (
          /* Authenticated State */
          <div className="space-y-6">
            {/* Search bar & Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input
                  id="people-search-input"
                  type="text"
                  placeholder="Search by name, birthplace, birth year, or occupation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <label className="flex items-center gap-2 text-xs text-stone-400 bg-stone-900 px-3 py-2 rounded-xl border border-stone-800 cursor-pointer select-none hover:text-stone-300">
                  <input
                    type="checkbox"
                    checked={showMerged}
                    onChange={(e) => setShowMerged(e.target.checked)}
                    className="rounded bg-stone-950 border-stone-700 text-amber-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Show Merged Duplicates</span>
                </label>

                <span className="text-xs font-mono text-stone-400 bg-stone-900 px-3 py-2.5 rounded-xl border border-stone-800">
                  {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-stone-400 space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-stone-700 border-t-amber-400 animate-spin mx-auto"></div>
                <p className="text-sm font-mono">Querying PostgreSQL...</p>
              </div>
            ) : filteredPeople.length === 0 ? (
              /* Empty State */
              <div className="p-12 rounded-2xl bg-stone-900/50 border border-dashed border-stone-800 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 text-amber-400/80 flex items-center justify-center shadow-inner">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-stone-200">
                    {searchQuery ? 'No matching people found' : 'No People Records Yet'}
                  </h3>
                  <p className="text-sm text-stone-400 max-w-md mx-auto leading-relaxed mt-1">
                    {searchQuery
                      ? 'Try clearing your search query to see all indexed person records.'
                      : 'Create your first person record and attach sourced attribute claims (name, birth date, birthplace, occupation).'}
                  </p>
                </div>

                {!searchQuery && (
                  <button
                    id="create-first-person-btn"
                    onClick={() => setCreateModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95 mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Person</span>
                  </button>
                )}
              </div>
            ) : (
              /* People Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPeople.map((p) => {
                  const evalData = evaluatePersonClaims(p.claims || []);
                  const bestName = evalData['name']?.bestClaims[0]?.value || 'Unnamed Person';
                  const bestBirth = evalData['birth_date']?.bestClaims[0]?.value;
                  const bestPlace = evalData['birth_place']?.bestClaims[0]?.value;
                  const bestOcc = evalData['occupation']?.bestClaims[0]?.value;
                  const totalClaims = p.claims?.length || 0;
                  const activeClaims = p.claims?.filter((c) => c.status === 'active').length || 0;
                  const nameTier = evalData['name']?.bestClaims[0]?.source?.reliabilityTier ?? 1;
                  const nameTierStyle = getTierBadgeStyle(nameTier);

                  return (
                    <div
                      key={p.personId}
                      id={`person-card-${p.personId}`}
                      onClick={() => handleSelectPerson(p)}
                      className="p-5 rounded-2xl bg-stone-900 border border-stone-800/90 hover:border-amber-500/50 cursor-pointer transition-all hover:bg-stone-850 shadow-md group flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${nameTierStyle.bg} ${nameTierStyle.text} ${nameTierStyle.border}`}
                              >
                                Tier {nameTier} Evidence
                              </span>

                              {p.isLiving ? (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                                  Living
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-800 text-stone-400">
                                  Deceased
                                </span>
                              )}

                              {p.mergedInto && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                                  Merged Record
                                </span>
                              )}
                            </div>

                            <h3 className="text-xl font-bold text-stone-100 group-hover:text-amber-300 transition-colors font-serif">
                              {bestName}
                            </h3>
                          </div>

                          <div className="p-2 rounded-xl bg-stone-950 text-stone-500 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>

                        {/* Attribute Badges */}
                        <div className="space-y-1.5 text-xs text-stone-300">
                          {bestBirth && (
                            <div className="flex items-center gap-2 text-stone-300">
                              <Calendar className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                              <span className="truncate">Born: {bestBirth}</span>
                            </div>
                          )}

                          {bestPlace && (
                            <div className="flex items-center gap-2 text-stone-300">
                              <MapPin className="w-3.5 h-3.5 text-blue-400/80 shrink-0" />
                              <span className="truncate">{bestPlace}</span>
                            </div>
                          )}

                          {bestOcc && (
                            <div className="flex items-center gap-2 text-stone-300">
                              <Briefcase className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                              <span className="truncate">{bestOcc}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Info */}
                      <div className="pt-3 border-t border-stone-800/60 flex items-center justify-between text-[11px] font-mono text-stone-400">
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>{totalClaims} claim{totalClaims > 1 ? 's' : ''} ({activeClaims} active)</span>
                        </div>

                        <span className="text-stone-500">ID: {p.personId.slice(0, 8)}...</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Architecture Explanatory Box */}
            <div className="p-5 rounded-xl bg-stone-900 border border-stone-800/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                <Info className="w-4 h-4 text-amber-400" />
                <span>Sourced Relational Architecture</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Click any person card above to inspect their profile. In accordance with strict genealogy standards, all attributes are computed from individual claim assertions and their respective source reliability ratings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Person Modal */}
      {createModalOpen && (
        <CreatePersonModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onPersonCreated={handlePersonCreated}
          getIdToken={getIdToken}
        />
      )}

      {/* Relationship Calculator Modal */}
      {calculatorModalOpen && (
        <RelationshipCalculatorModal
          isOpen={calculatorModalOpen}
          onClose={() => setCalculatorModalOpen(false)}
          onSelectPerson={(personId) => {
            setCalculatorModalOpen(false);
            const found = people.find((p) => p.personId === personId);
            if (found) {
              setActivePerson(found);
            }
          }}
        />
      )}
    </div>
  );
};
