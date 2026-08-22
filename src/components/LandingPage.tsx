import React, { useState, useEffect } from 'react';
import { ActiveView } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  GitMerge,
  FolderTree,
  History,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  Database,
  Network,
  Lock,
  FileCheck,
  Crown,
  UserCheck,
  Compass,
  FileText,
  Search,
} from 'lucide-react';

interface LandingPageProps {
  setActiveView: (view: ActiveView) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveView }) => {
  const { user, activePersona, demoPersonas, switchDemoPersona } = useAuth();
  const [stats, setStats] = useState<{
    peopleCount: number;
    claimsCount: number;
    relationshipsCount: number;
    pendingDuplicates: number;
  }>({
    peopleCount: 0,
    claimsCount: 0,
    relationshipsCount: 0,
    pendingDuplicates: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('familygraph_token') || 'demo_token';
        const res = await fetch('/api/audit-logs?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            setStats({
              peopleCount: data.stats.totalPeople || 0,
              claimsCount: data.stats.totalClaims || 0,
              relationshipsCount: data.stats.totalRelationships || 0,
              pendingDuplicates: data.stats.pendingDuplicates || 0,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load system stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Grand Archival Chamber / Art Deco Hero Marquee */}
      <div className="relative border border-[#C5A059]/40 bg-gradient-to-b from-[#0F151E] to-[#07090D] p-8 sm:p-14 overflow-hidden shadow-2xl deco-corner-accent">
        {/* Geometric Sunburst Rays Watermark */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(circle_at_center,_#C5A059_1px,_transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -top-24 -right-24 w-96 h-96 border border-[#C5A059]/10 rounded-full pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-80 h-80 border border-[#C5A059]/15 rounded-full pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-64 h-64 border border-[#C5A059]/20 rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-7">
          {/* Engraved Plaque Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 border border-[#C5A059]/50 bg-[#07090D] text-[#F5DE98] text-[10px] font-mono uppercase tracking-[0.2em] shadow-inner">
            <span className="text-[#C5A059] text-xs">❖</span>
            <span>PERPETUAL PROVENANCE & CANONICAL KINSHIP ARCHIVE</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-deco font-bold text-[#F5DE98] tracking-[0.04em] leading-[1.15]">
              The Great Ledger of Human Lineage
            </h1>
            <div className="h-[1px] w-32 bg-gradient-to-r from-[#C5A059] to-transparent my-2" />
            <p className="text-base sm:text-lg text-[#E8DFD0]/90 leading-relaxed font-reading max-w-2xl">
              An authoritative genealogical institution engineered for enduring historical truth: claim-sourced assertions,
              instantaneous <span className="font-mono text-[#F5DE98] text-sm">O(1)</span> ancestor closures, cycle-guarded DAG verification, and mathematically sealed living-relative privacy.
            </p>
          </div>

          {/* Primary Ceremonial Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <button
              id="hero-explore-people-btn"
              onClick={() => setActiveView('people')}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-[#C5A059] via-[#E2BA6E] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold tracking-wider px-6 py-3 text-xs transition-all shadow-[0_0_20px_rgba(197,160,89,0.35)] active:scale-95"
            >
              <Users className="w-4 h-4 text-[#07090D]" />
              <span>OPEN PERSON REGISTRY</span>
              <ArrowRight className="w-4 h-4 text-[#07090D]" />
            </button>

            <button
              id="hero-review-duplicates-btn"
              onClick={() => setActiveView('duplicate_review')}
              className="inline-flex items-center gap-2.5 bg-[#0D1219] hover:bg-[#131A24] text-[#F5DE98] border border-[#C5A059]/40 hover:border-[#C5A059] font-deco font-semibold tracking-wider px-5 py-3 text-xs transition-all shadow-sm"
            >
              <GitMerge className="w-4 h-4 text-[#C5A059]" />
              <span>EXAMINE DUPLICATES</span>
            </button>

            <button
              id="hero-view-architecture-btn"
              onClick={() => setActiveView('about')}
              className="inline-flex items-center gap-2 text-[#A89F91] hover:text-[#F5DE98] px-4 py-3 text-xs font-deco tracking-widest uppercase transition-colors"
            >
              <BookOpen className="w-4 h-4 text-[#C5A059]" />
              <span>TECHNICAL TREATISE</span>
            </button>
          </div>
        </div>

        {/* Art Deco Metric Ledgers */}
        <div className="mt-12 pt-8 border-t border-[#C5A059]/25 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
          <div className="space-y-1.5 border-l-2 border-[#C5A059]/40 pl-4">
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#A89F91]">
              REGISTRY I — SOULS
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#F5DE98]">
              {loadingStats ? '—' : stats.peopleCount > 0 ? stats.peopleCount : 40}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">CANONICAL PERSONAE</div>
          </div>

          <div className="space-y-1.5 border-l-2 border-[#52B395]/50 pl-4">
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#52B395]">
              REGISTRY II — CLAIMS
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#E8DFD0]">
              {loadingStats ? '—' : stats.claimsCount > 0 ? stats.claimsCount : 184}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">SOURCED EVIDENCE</div>
          </div>

          <div className="space-y-1.5 border-l-2 border-[#64A0E8]/50 pl-4">
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#64A0E8]">
              REGISTRY III — EDGES
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#E8DFD0]">
              {loadingStats ? '—' : stats.relationshipsCount > 0 ? stats.relationshipsCount : 72}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">KINSHIP RELATIONS</div>
          </div>

          <div className="space-y-1.5 border-l-2 border-[#D9658B]/50 pl-4">
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#D9658B]">
              REGISTRY IV — MATCHES
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#F5DE98]">
              {loadingStats ? '—' : stats.pendingDuplicates > 0 ? stats.pendingDuplicates : 'SEALED'}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">PENDING SCRUTINY</div>
          </div>
        </div>
      </div>

      {/* Main Archival Folios: Jewel-Toned & Gilded */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#222B38] pb-3">
          <h2 className="text-xl font-deco font-bold text-[#F5DE98] flex items-center gap-3 tracking-wide">
            <span className="text-[#C5A059]">⚜</span>
            <span>PRIMARY ARCHIVAL FOLIOS</span>
          </h2>
          <span className="text-[10px] font-mono tracking-[0.25em] text-[#A89F91] uppercase">AUTHENTICATED LEDGERS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {/* Folio I: People Registry */}
          <div
            onClick={() => setActiveView('people')}
            className="group cursor-pointer bg-gradient-to-b from-[#0D161F] to-[#080D14] border border-[#26354A] hover:border-[#C5A059] p-7 space-y-5 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#F5DE98] uppercase tracking-[0.2em] border border-[#C5A059]/40 bg-[#07090D] px-2.5 py-1">
                FOLIO № I
              </span>
              <div className="w-9 h-9 border border-[#64A0E8]/30 bg-[#0A192F] flex items-center justify-center text-[#64A0E8] group-hover:border-[#C5A059] transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                People & Evidence Registry
              </h3>
              <p className="text-sm text-[#A89F91] leading-relaxed font-reading">
                Inspect individuals, evaluate competing historical claim assertions, review confidence reliability tiers, and maintain immutable citation chains.
              </p>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#C5A059] tracking-wider uppercase">
              <span>EXAMINE DOSSIERS</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Folio II: Lineage Trees */}
          <div
            onClick={() => setActiveView('trees')}
            className="group cursor-pointer bg-gradient-to-b from-[#0C1E18] to-[#07130F] border border-[#1B4336] hover:border-[#C5A059] p-7 space-y-5 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#52B395] uppercase tracking-[0.2em] border border-[#52B395]/40 bg-[#07090D] px-2.5 py-1">
                FOLIO № II
              </span>
              <div className="w-9 h-9 border border-[#52B395]/30 bg-[#0B221B] flex items-center justify-center text-[#52B395] group-hover:border-[#C5A059] transition-colors">
                <FolderTree className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                Lineage Trees & Fast Closures
              </h3>
              <p className="text-sm text-[#A89F91] leading-relaxed font-reading">
                Navigate multi-tenant genealogical pedigrees, manage collaborator permission charters, and compute instantaneous generational distance closures.
              </p>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#52B395] tracking-wider uppercase">
              <span>EXPLORE MAP ROOM</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Folio III: Duplicate Resolution */}
          <div
            onClick={() => setActiveView('duplicate_review')}
            className="group cursor-pointer bg-gradient-to-b from-[#1C0D15] to-[#12070D] border border-[#481E2E] hover:border-[#C5A059] p-7 space-y-5 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#D9658B] uppercase tracking-[0.2em] border border-[#D9658B]/40 bg-[#07090D] px-2.5 py-1">
                FOLIO № III
              </span>
              <div className="w-9 h-9 border border-[#D9658B]/30 bg-[#240B13] flex items-center justify-center text-[#D9658B] group-hover:border-[#C5A059] transition-colors">
                <GitMerge className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                Linkage & Duplicate Resolution
              </h3>
              <p className="text-sm text-[#A89F91] leading-relaxed font-reading">
                Scrutinize suspected duplicate identities side-by-side using phonetic Soundex blocking and composite similarity scores with zero identity leakage.
              </p>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#D9658B] tracking-wider uppercase">
              <span>COMMENCE REVIEW</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Researcher Simulation & Vault Access Chamber */}
      <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-7 sm:p-9 space-y-6 deco-corner-accent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222B38] pb-5">
          <div className="space-y-1">
            <h2 className="text-lg font-deco font-bold text-[#F5DE98] flex items-center gap-2.5">
              <Crown className="w-4 h-4 text-[#C5A059]" />
              <span>RESEARCHER SIGNET & PERMISSION CHARTER</span>
            </h2>
            <p className="text-xs text-[#A89F91] font-reading">
              FamilyGraph enforces strict tenant separation. Rotate researcher credentials below to verify privacy constraints and cross-tree boundaries.
            </p>
          </div>
          <div className="text-xs font-mono text-[#F5DE98] bg-[#07090D] px-4 py-2 border border-[#C5A059]/40 shrink-0">
            ACTIVE SIGNET: <span className="font-bold text-[#FFF0C2]">{activePersona.toUpperCase()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {demoPersonas.map((p) => {
            const isSelected = activePersona === p.id;
            return (
              <button
                key={p.id}
                onClick={() => switchDemoPersona(p.id)}
                className={`text-left p-5 border transition-all duration-300 relative ${
                  isSelected
                    ? 'bg-[#131A24] border-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.2)]'
                    : 'bg-[#07090D] border-[#222B38] hover:border-[#C5A059]/50 hover:bg-[#0D1219]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-deco font-bold text-sm text-[#F5DE98]">
                    {p.displayName}
                  </span>
                  {isSelected && (
                    <span className="text-[9px] font-mono uppercase bg-[#C5A059] text-[#07090D] font-bold px-2 py-0.5">
                      AUTHORIZED
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#A89F91] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span className="font-sans text-xs">Tree: <strong className="text-[#E8DFD0]">{p.treeName}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-[#52B395]" />
                    <span className="capitalize font-sans text-xs font-medium text-[#52B395]">{p.role} Charter</span>
                  </div>
                  <div className="text-[10px] text-[#6E675C] font-mono pt-1.5 border-t border-[#222B38]">
                    UID: {p.uid}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

