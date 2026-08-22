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
  Workflow,
  Scroll,
  Binary,
  Compass,
} from 'lucide-react';
import { motion } from 'motion/react';

export const AboutArchitecturePage: React.FC = () => {
  return (
    <div id="about_architecture_page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 font-sans">
      {/* Monograph Header */}
      <div className="text-center space-y-5 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm border border-[#D4AF37]/50 bg-[#1A1813] text-[#D4AF37] text-[11px] font-mono uppercase tracking-[0.25em]">
          <Scroll className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL TECHNICAL MONOGRAPH • FOLIO № 500</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F4EDE2] tracking-tight uppercase leading-tight">
          Architectural Treatise & Graph Foundations
        </h1>
        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto"></div>
        <p className="text-base sm:text-lg font-serif text-[#C4B59D] leading-relaxed italic">
          A genealogical records institution engineered on claim-centric event sourcing, directed acyclic graph cycle validation, incremental ancestor closure indexing, and zero-information-leak cryptographic privacy.
        </p>
      </div>

      {/* Architecture Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pillar 1: Claim-Centric Modeling */}
        <div className="deco-card bg-[#15191E] border-2 border-[#D4AF37]/30 rounded-sm p-8 space-y-5 shadow-lg relative">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
            <h3 className="text-lg font-display font-bold text-[#F4EDE2] flex items-center gap-3 uppercase tracking-wider">
              <Layers className="w-5 h-5 text-[#D4AF37]" />
              <span>1. Claim-Centric Event Sourcing</span>
            </h3>
            <span className="text-[10px] font-mono text-[#D4AF37] bg-[#101317] px-2 py-0.5 rounded-sm border border-[#2B333C]">
              table: person_claim
            </span>
          </div>

          <p className="text-xs font-serif text-[#C4B59D] leading-relaxed italic text-[14px]">
            Unlike naive tabular schemas that store static single-value columns on person entities, FamilyGraph models historical reality through <strong className="text-[#F4EDE2] font-semibold">sourced evidentiary assertions</strong>.
          </p>

          <ul className="space-y-3 text-xs font-serif text-[#A69B8D]">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Multi-Claim Coexistence:</strong> Conflicting assertions (e.g. military pension vs baptismal register) coexist naturally without data loss.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">5-Tier Reliability Hierarchy:</strong> From Tier 1 (Oral Recollection) to Tier 5 (Official Vital Record Certificate).</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Non-Destructive Supersession:</strong> New evidence supersedes older claims while preserving complete provenance in the immutable audit log.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 2: Ancestor Closure Table & DAG Validation */}
        <div className="deco-card bg-[#15191E] border-2 border-[#D4AF37]/30 rounded-sm p-8 space-y-5 shadow-lg relative">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
            <h3 className="text-lg font-display font-bold text-[#F4EDE2] flex items-center gap-3 uppercase tracking-wider">
              <Workflow className="w-5 h-5 text-[#85C49F]" />
              <span>2. Transitive Closure Indexing ($O(1)$)</span>
            </h3>
            <span className="text-[10px] font-mono text-[#85C49F] bg-[#101317] px-2 py-0.5 rounded-sm border border-[#2B333C]">
              table: ancestor_closure
            </span>
          </div>

          <p className="text-xs font-serif text-[#C4B59D] leading-relaxed italic text-[14px]">
            Recursive SQL Common Table Expressions degrade exponentially across deep genealogical branches. FamilyGraph maintains an indexed transitive closure index storing <code>(descendant_id, ancestor_id, min_generations)</code>.
          </p>

          <ul className="space-y-3 text-xs font-serif text-[#A69B8D]">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">DAG Cycle Invariant:</strong> BFS graph traversal strictly prohibits any relationship edge that would cause an individual to become their own ancestor.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Incremental Recomputation:</strong> Relationship updates re-index only the affected downstream subtrees without full database scans.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Pedigree Collapse:</strong> Correctly tracks multiple generational pathways resulting from consanguineous marriages.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 3: Multi-Factor Duplicate Resolution */}
        <div className="deco-card bg-[#15191E] border-2 border-[#D4AF37]/30 rounded-sm p-8 space-y-5 shadow-lg relative">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
            <h3 className="text-lg font-display font-bold text-[#F4EDE2] flex items-center gap-3 uppercase tracking-wider">
              <GitMerge className="w-5 h-5 text-[#8DB4DB]" />
              <span>3. Phonetic Soundex & Merge Engine</span>
            </h3>
            <span className="text-[10px] font-mono text-[#8DB4DB] bg-[#101317] px-2 py-0.5 rounded-sm border border-[#2B333C]">
              table: match_candidate
            </span>
          </div>

          <p className="text-xs font-serif text-[#C4B59D] leading-relaxed italic text-[14px]">
            Employs a 2-stage reconciliation pipeline to discover duplicate records across trees without exhaustive $O(N^2)$ comparisons.
          </p>

          <ul className="space-y-3 text-xs font-serif text-[#A69B8D]">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Soundex Candidate Blocking:</strong> Indexes surnames into phonetic equivalence bins combined with birth decade windows.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Multi-Factor Composite Score:</strong> Evaluates Levenshtein edit distance, geographic proximity, and kinship overlap.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Reversible Merging:</strong> Sets <code>merged_into</code> on secondary records with instant unmerge restoration capabilities.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 4: Zero-Information-Leak Living Privacy */}
        <div className="deco-card bg-[#15191E] border-2 border-[#D4AF37]/30 rounded-sm p-8 space-y-5 shadow-lg relative">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
            <h3 className="text-lg font-display font-bold text-[#F4EDE2] flex items-center gap-3 uppercase tracking-wider">
              <Lock className="w-5 h-5 text-[#D4AF37]" />
              <span>4. Zero-Leak Living Privacy Protocol</span>
            </h3>
            <span className="text-[10px] font-mono text-[#D4AF37] bg-[#101317] px-2 py-0.5 rounded-sm border border-[#2B333C]">
              table: user_consent
            </span>
          </div>

          <p className="text-xs font-serif text-[#C4B59D] leading-relaxed italic text-[14px]">
            Safeguards the privacy of living individuals while allowing consenting genealogical researchers to discover mutual family connections.
          </p>

          <ul className="space-y-3 text-xs font-serif text-[#A69B8D]">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Dual-Consent Handshake:</strong> Living individuals are only cross-referenced when both repository curators grant explicit opt-in consent.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Zero Metadata Leakage:</strong> Non-consenting queries return completely empty responses without revealing silhouette counts or existence hints.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#85C49F] shrink-0 mt-0.5" />
              <span><strong className="text-[#F4EDE2]">Multi-Tenant RBAC:</strong> Strict boundary isolation between Tree Owners, Editors, and Viewers.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Cryptographic SHA-256 Provenance Monograph */}
      <div className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm p-8 sm:p-10 space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.7)] relative overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[#D4AF37]/30 pb-4">
          <div className="w-10 h-10 rounded-sm border border-[#D4AF37] bg-[#120F0B] flex items-center justify-center text-[#D4AF37]">
            <ShieldCheck className="w-6 h-6 text-[#85C49F]" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">PROVENANCE INTEGRITY ANCHOR</div>
            <h3 className="text-xl font-display font-bold text-[#F4EDE2] uppercase tracking-wider">
              Cryptographic SHA-256 Primary Source Verification
            </h3>
          </div>
        </div>

        <p className="text-sm font-serif text-[#C4B59D] leading-relaxed italic">
          Every archival document uploaded to FamilyGraph — whether high-resolution census schedules, parish registers, civil vital certificates, or familial portraits — is processed through the browser Web Crypto API to generate a canonical SHA-256 cryptographic digest prior to persistent database anchoring. This immutable checksum guarantees permanent bit-level authenticity against alteration, loss of fidelity, or unauthorized document tampering.
        </p>
      </div>
    </div>
  );
};
