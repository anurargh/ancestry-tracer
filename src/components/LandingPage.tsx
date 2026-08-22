import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ActiveView } from '../types.ts';
import {
  Network,
  Users,
  Database,
  Lock,
  GitFork,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Binary,
  GitMerge,
  Compass,
} from 'lucide-react';

interface LandingPageProps {
  setActiveView: (view: ActiveView) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveView }) => {
  const { user, signInWithGoogle } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-950 text-stone-100 flex flex-col justify-between">
      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 flex-1">
        <div className="text-center max-w-3xl mx-auto">
          {/* Eyebrow / System badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Relational Genealogies, Kinship Calculation & Duplicate Detection</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-100 font-serif leading-tight">
            Map your lineage with{' '}
            <span className="text-amber-400 underline decoration-amber-500/40 decoration-4 underline-offset-8">
              relational precision
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-stone-400 max-w-2xl mx-auto leading-relaxed">
            FamilyGraph is engineered on Cloud SQL PostgreSQL with transitive ancestor closure tables,
            evidence reliability tiers, precise degree-of-kinship explanations, and phonetic duplicate detection.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <>
                <button
                  id="hero-go-people-btn"
                  onClick={() => setActiveView('people')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-6 py-3 rounded-xl transition-all shadow-md active:scale-95"
                >
                  <Users className="w-5 h-5" />
                  <span>Open People Registry</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                <button
                  id="hero-go-duplicates-btn"
                  onClick={() => setActiveView('duplicate_review')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 px-6 py-3 rounded-xl transition-colors"
                >
                  <GitMerge className="w-4 h-4 text-amber-400" />
                  <span>Duplicate Review Queue</span>
                </button>
              </>
            ) : (
              <button
                id="hero-sign-in-btn"
                onClick={signInWithGoogle}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-6 py-3 rounded-xl transition-all shadow-md active:scale-95"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Sign in with Google to Start</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div
            onClick={() => setActiveView('people')}
            className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
              <Binary className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-stone-200 mb-1.5 group-hover:text-amber-300 transition-colors">
              Claim-Centric Lineage Graph
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Evidence-based claims, DAG cycle prevention, and incremental ancestor closure index ($O(1)$).
            </p>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => setActiveView('trees')}
            className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
              <Compass className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-stone-200 mb-1.5 group-hover:text-emerald-300 transition-colors">
              Trees & RBAC Governance
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Multi-tree management with strict Owner, Editor, and Viewer roles gating graph mutations.
            </p>
          </div>

          {/* Card 3 */}
          <div
            onClick={() => setActiveView('duplicate_review')}
            className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-105 transition-transform">
              <GitMerge className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-stone-200 mb-1.5 group-hover:text-blue-300 transition-colors">
              Phonetic Duplicate Resolution
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Soundex candidate blocking, Levenshtein edit distance, and non-destructive entity merging.
            </p>
          </div>

          {/* Card 4 */}
          <div
            onClick={() => setActiveView('audit_log')}
            className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-stone-200 mb-1.5 group-hover:text-rose-300 transition-colors">
              Immutable Audit Log
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Tracks every claim, relationship, and merge mutation with before/after state diff snapshots.
            </p>
          </div>

          {/* Card 5 */}
          <div
            onClick={() => setActiveView('about')}
            className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-105 transition-transform">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-stone-200 mb-1.5 group-hover:text-indigo-300 transition-colors">
              Zero-Leak Living Privacy
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Bilateral consent discovery for living persons without revealing masked existence markers.
            </p>
          </div>

          {/* Card 6 */}
          <div
            onClick={() => setActiveView('about')}
            className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-stone-200 mb-1.5 group-hover:text-purple-300 transition-colors">
              Architecture Demo Summary
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Executive walkthrough of DAG structures, transitive closures, phonetic blocking, and media hashes.
            </p>
          </div>
        </div>

        {/* Database Status Banner */}
        <div className="mt-10 p-4 rounded-xl bg-stone-900 border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stone-400">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="text-stone-200 font-medium">Cloud SQL PostgreSQL:</span> Active & Connected{' '}
              <code className="text-amber-300 font-mono text-xs">(Drizzle ORM Engine)</code>
            </div>
          </div>
          <div className="text-xs text-stone-400 font-mono">
            Lineage • Claims • Kinship • Duplicates
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-900 py-6 text-center text-xs text-stone-400">
        FamilyGraph &copy; {new Date().getFullYear()} • Genealogical Record and Relative-Discovery System
      </footer>
    </div>
  );
};
