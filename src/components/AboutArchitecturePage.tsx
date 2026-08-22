import React from 'react';
import {
  Layers,
  ShieldCheck,
  GitMerge,
  Cpu,
  Lock,
  History,
  FileCheck,
  Network,
  CheckCircle2,
  Database,
  ArrowRight,
  Sparkles,
  Users,
  Search,
  BookOpen,
} from 'lucide-react';

export const AboutArchitecturePage: React.FC = () => {
  return (
    <div id="about_architecture_page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Technical Demo Overview
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          FamilyGraph Architecture & Core Engineering
        </h1>
        <p className="text-base text-slate-400 leading-relaxed">
          A modern genealogical system built with claim-centric event sourcing, DAG cycle prevention, incremental ancestor closure indexing, multi-factor duplicate resolution, and zero-information-leak privacy.
        </p>
      </div>

      {/* Architecture Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1: Claim-Centric Modeling */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-md">
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              1. Claim-Centric Event Sourcing
            </h3>
            <p className="text-xs font-mono text-purple-400 mt-0.5">
              table: person_claim & source
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Unlike traditional monolithic family tree databases that store a single static name or birth date column on the person record, FamilyGraph models genealogical reality through <strong className="text-slate-100">evidential claims</strong>.
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Multiple conflicting assertions (e.g. varying birth years in census vs death certificate) can coexist.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Claims have reliability tiers (1=Oral Tradition to 5=Official Certificate) and confidence scoring.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Superseding an assertion preserves full historical provenance rather than destructive overwrites.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 2: Ancestor Closure Table & DAG Validation */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-md">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              2. Fast Transitive Ancestor Closure ($O(1)$)
            </h3>
            <p className="text-xs font-mono text-emerald-400 mt-0.5">
              table: ancestor_closure & parent_child
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Recursive SQL CTEs degrade rapidly across deep genealogical lineages. FamilyGraph maintains an indexed transitive closure table storing <code>(descendant_id, ancestor_id, generations)</code>.
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>DAG Cycle Prevention:</strong> BFS graph traversal blocks any relationship where a person would become their own ancestor.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Incremental Updates:</strong> Modifying an edge only recomputes affected downstream subtrees.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Pedigree Collapse Handling:</strong> Accurately resolves cousin marriages by finding the minimum generation path.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 3: Multi-Factor Duplicate Resolution */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-md">
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              3. Phonetic Soundex & Duplicate Resolution
            </h3>
            <p className="text-xs font-mono text-blue-400 mt-0.5">
              table: match_candidate
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Identifies potential duplicate individuals across trees using a 2-stage pipeline to avoid $O(N^2)$ exhaustive comparisons.
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Candidate Blocking:</strong> Filters candidate pairs using Soundex phonetic surname keys + birth decade windows.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Composite Scoring:</strong> Evaluates Levenshtein edit distance, birth place tokens, and parent/spouse overlap.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Non-Destructive Merging:</strong> Sets <code>merged_into</code> pointing to the canonical record with full unmerge/revert capability.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 4: Zero-Information-Leak Living Privacy */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-md">
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              4. Zero-Information-Leak Privacy & Discovery
            </h3>
            <p className="text-xs font-mono text-amber-400 mt-0.5">
              privacy_level: 'family_only' | 'public'
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Protects living individuals while empowering researchers to connect across tree boundaries through strict cryptographic privacy standards.
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Living Default:</strong> Any person with <code>is_living = true</code> defaults to <code>family_only</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Bilateral Opt-In:</strong> Relative discovery requires mutual opt-in from both the searching user and the tree owner.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Zero Leakage:</strong> If either party hasn't opted in, the candidate is completely dropped with no "hidden match" placeholder.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 5: Granular Tree RBAC */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-md">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              5. Per-Tree Role-Based Access Control (RBAC)
            </h3>
            <p className="text-xs font-mono text-indigo-400 mt-0.5">
              roles: 'owner' | 'editor' | 'viewer'
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Multi-user collaboration with strict role boundaries enforced across every API mutation route:
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span><strong>Owner:</strong> Full control over tree metadata, member management, and role promotion.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span><strong>Editor:</strong> Can add claims, mutate parent-child relationships, confirm duplicate merges, and attach media.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span><strong>Viewer:</strong> Read-only access to tree nodes and non-living public profiles.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 6: Immutable Audit Trail & Cryptographic Media */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-md">
          <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              6. Immutable Audit Trail & SHA-256 Provenance
            </h3>
            <p className="text-xs font-mono text-rose-400 mt-0.5">
              tables: audit_log & person_media
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Complete compliance and data integrity tracking for every tree operation:
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span><strong>Audit Trail:</strong> Records <code>entity_type</code>, <code>entity_id</code>, <code>action</code>, <code>old_value</code>, <code>new_value</code>, <code>changed_by</code>, and <code>changed_at</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span><strong>Media Provenance:</strong> Every photo, census record, and certificate computes a SHA-256 hash verified on client and server.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span><strong>Audit Inspector:</strong> Admin page provides side-by-side JSON diffs of historical state mutations.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Interactive Flow Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-8 space-y-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          Full System Data Flow
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-indigo-400 font-bold block">STEP 1: INGESTION</span>
            <p className="text-slate-300 font-medium">Claims & Sources</p>
            <p className="text-slate-500">
              Users assert claims with reliability citations and media attachments tagged with SHA-256 hashes.
            </p>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-emerald-400 font-bold block">STEP 2: TOPOLOGY</span>
            <p className="text-slate-300 font-medium">DAG & Closure Index</p>
            <p className="text-slate-500">
              Cycle detection runs during linking; closure table updates incrementally for instant relationship querying.
            </p>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-blue-400 font-bold block">STEP 3: MATCHING</span>
            <p className="text-slate-300 font-medium">Duplicate Resolution</p>
            <p className="text-slate-500">
              Phonetic Soundex blocking screens candidate pairs; multi-factor weights score similarities.
            </p>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-rose-400 font-bold block">STEP 4: GOVERNANCE</span>
            <p className="text-slate-300 font-medium">Audit & Privacy</p>
            <p className="text-slate-500">
              Bilateral discovery consent gates living records; all mutations record immutable audit diffs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
