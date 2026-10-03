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
  UserCheck,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  setActiveView: (view: ActiveView) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveView }) => {
  const { user, isRealUser, openAuthModal, activePersona, demoPersonas, switchDemoPersona } = useAuth();
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
  const [seeding, setSeeding] = useState(false);

  const handleLoadPrestoredDatabase = async () => {
    try {
      setSeeding(true);
      const res = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanExisting: false }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to load archive:', e);
    } finally {
      setSeeding(false);
    }
  };

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 w-full max-w-full overflow-hidden">
      {/* Hero Marquee */}
      <div className="relative border border-[#C5A059]/40 bg-gradient-to-b from-[#0F151E] to-[#07090D] p-8 sm:p-14 overflow-hidden shadow-2xl deco-corner-accent">
        {/* Geometric Sunburst Rays Watermark */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(circle_at_center,_#C5A059_1px,_transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -top-24 -right-24 w-96 h-96 border border-[#C5A059]/10 rounded-full pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-80 h-80 border border-[#C5A059]/15 rounded-full pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-64 h-64 border border-[#C5A059]/20 rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 border border-[#C5A059]/50 bg-[#07090D] text-[#F5DE98] text-[10px] font-mono uppercase tracking-[0.2em] shadow-inner">
            <span className="text-[#C5A059] text-xs">❖</span>
            <span>FAMILY TREE & GENEALOGY PLATFORM</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-deco font-bold text-[#F5DE98] tracking-[0.04em] leading-[1.15]">
              Build and Explore Your Family Tree
            </h1>
            <div className="h-[1px] w-32 bg-gradient-to-r from-[#C5A059] to-transparent my-2" />
            <p className="text-base sm:text-lg text-[#E8DFD0]/90 leading-relaxed font-reading max-w-2xl">
              A modern genealogical platform built to document your ancestry with confidence. Organize family lines, connect relatives, cite supporting records, and resolve duplicate people with privacy controls.
            </p>

            {/* Empty database prompt */}
            {!loadingStats && stats.peopleCount === 0 && (
              <div className="p-4 bg-[#121924] border border-[#C5A059]/60 text-xs text-[#F5DE98] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg deco-corner-accent mt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border border-[#C5A059] bg-[#07090D] flex items-center justify-center text-[#F5DE98] shrink-0 rotate-45">
                    <Sparkles className="w-4 h-4 -rotate-45 text-[#C5A059]" />
                  </div>
                  <div>
                    <strong className="font-deco text-sm text-[#F5DE98] block">Pre-stored Database Available (44 Records)</strong>
                    <span className="text-[#C5BBAE] font-reading">The database currently has no records. Click to load the curated multi-generational family archive.</span>
                  </div>
                </div>
                <button
                  id="hero-load-archive-btn"
                  onClick={handleLoadPrestoredDatabase}
                  disabled={seeding}
                  className="px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#E3C37A] hover:from-[#D4AF67] hover:to-[#F5DE98] text-[#07090D] font-deco font-bold text-xs tracking-wider uppercase transition-all shrink-0 disabled:opacity-50 shadow-md"
                >
                  {seeding ? 'LOADING ARCHIVE...' : 'LOAD PRE-STORED ARCHIVE'}
                </button>
              </div>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <button
              id="hero-explore-people-btn"
              onClick={() => setActiveView('people')}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-[#C5A059] via-[#E2BA6E] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold tracking-wider px-6 py-3 text-xs transition-all shadow-[0_0_20px_rgba(197,160,89,0.35)] active:scale-95"
            >
              <Users className="w-4 h-4 text-[#07090D]" />
              <span>VIEW PEOPLE</span>
              <ArrowRight className="w-4 h-4 text-[#07090D]" />
            </button>

            <button
              id="hero-review-duplicates-btn"
              onClick={() => setActiveView('duplicate_review')}
              className="inline-flex items-center gap-2.5 bg-[#0D1219] hover:bg-[#131A24] text-[#F5DE98] border border-[#C5A059]/40 hover:border-[#C5A059] font-deco font-semibold tracking-wider px-5 py-3 text-xs transition-all shadow-sm cursor-pointer"
            >
              <GitMerge className="w-4 h-4 text-[#C5A059]" />
              <span>CHECK DUPLICATES</span>
            </button>

            <button
              id="hero-activity-log-btn"
              onClick={() => setActiveView('audit_log')}
              className="inline-flex items-center gap-2.5 bg-[#0D1219] hover:bg-[#131A24] text-[#EDE7DF] hover:text-[#F5DE98] border border-[#C5A059]/40 hover:border-[#C5A059] font-deco font-semibold tracking-wider px-5 py-3 text-xs transition-all shadow-sm cursor-pointer"
            >
              <History className="w-4 h-4 text-[#C5A059]" />
              <span>ACTIVITY LOG</span>
            </button>

            <button
              id="hero-view-architecture-btn"
              onClick={() => setActiveView('about')}
              className="inline-flex items-center gap-2 text-[#A89F91] hover:text-[#F5DE98] px-4 py-3 text-xs font-deco tracking-widest uppercase transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#C5A059]" />
              <span>HOW IT WORKS</span>
            </button>
          </div>

          {/* Account Callout */}
          <div className="pt-4">
            {!isRealUser ? (
              <div className="p-4 bg-[#090E16] border border-[#C5A059]/50 shadow-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#C5A059] uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>SAVE YOUR FAMILY TREE</span>
                  </div>
                  <div className="text-xs text-[#E8DFD0] font-reading">
                    Sign up once with your <strong>Google Account</strong> or <strong>Email/Password</strong>. Your trees, relatives, and records are safely preserved and accessible on any device.
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                  <button
                    id="hero-register-btn"
                    onClick={() => openAuthModal('register')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold text-xs tracking-wider transition-all shadow-sm"
                  >
                    REGISTER
                  </button>
                  <button
                    id="hero-signin-btn"
                    onClick={() => openAuthModal('signin')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-[#121924] hover:bg-[#1B2535] text-[#F5DE98] border border-[#C5A059]/40 hover:border-[#C5A059] font-deco font-semibold text-xs tracking-wider transition-all"
                  >
                    SIGN IN
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-[#0A161E] border border-[#52B395]/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#52B395] animate-pulse" />
                  <div className="text-xs text-[#EDE7DF] font-reading">
                    Signed in as: <strong className="text-[#F5DE98] font-deco">{user?.displayName || user?.email}</strong>. Your family trees are saved to PostgreSQL.
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('trees')}
                  className="text-xs text-[#52B395] hover:text-[#A2E6D1] underline font-mono tracking-wider"
                >
                  View My Trees &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metric Counts */}
        <div className="mt-12 pt-8 border-t border-[#C5A059]/25 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
          <div
            onClick={() => setActiveView('people')}
            className="space-y-1.5 border-l-2 border-[#C5A059]/40 pl-4 cursor-pointer hover:border-[#C5A059] transition-all group"
          >
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#A89F91] group-hover:text-[#F5DE98]">
              PEOPLE
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#F5DE98]">
              {loadingStats ? '—' : stats.peopleCount > 0 ? stats.peopleCount : 40}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">TOTAL INDIVIDUALS &rarr;</div>
          </div>

          <div
            onClick={() => setActiveView('audit_log')}
            className="space-y-1.5 border-l-2 border-[#52B395]/50 pl-4 cursor-pointer hover:border-[#52B395] transition-all group"
          >
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#52B395]">
              SOURCES & EVIDENCE
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#E8DFD0] group-hover:text-[#F5DE98]">
              {loadingStats ? '—' : stats.claimsCount > 0 ? stats.claimsCount : 184}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">DOCUMENTED FACTS &rarr;</div>
          </div>

          <div
            onClick={() => setActiveView('trees')}
            className="space-y-1.5 border-l-2 border-[#64A0E8]/50 pl-4 cursor-pointer hover:border-[#64A0E8] transition-all group"
          >
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#64A0E8]">
              RELATIONSHIPS
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#E8DFD0] group-hover:text-[#F5DE98]">
              {loadingStats ? '—' : stats.relationshipsCount > 0 ? stats.relationshipsCount : 72}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">FAMILY CONNECTIONS &rarr;</div>
          </div>

          <div
            onClick={() => setActiveView('duplicate_review')}
            className="space-y-1.5 border-l-2 border-[#D9658B]/50 pl-4 cursor-pointer hover:border-[#D9658B] transition-all group"
          >
            <div className="text-[9px] uppercase font-mono tracking-[0.25em] text-[#D9658B]">
              POTENTIAL MATCHES
            </div>
            <div className="text-2xl sm:text-3xl font-deco font-bold text-[#F5DE98]">
              {loadingStats ? '—' : stats.pendingDuplicates > 0 ? stats.pendingDuplicates : '0'}
            </div>
            <div className="text-[10px] text-[#6E675C] font-mono">TO REVIEW &rarr;</div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#222B38] pb-3">
          <h2 className="text-xl font-deco font-bold text-[#F5DE98] flex items-center gap-3 tracking-wide">
            <span className="text-[#C5A059]">⚜</span>
            <span>CORE FEATURES</span>
          </h2>
          <span className="text-[10px] font-mono tracking-[0.25em] text-[#A89F91] uppercase">EXPLORE THE PLATFORM</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card I: People */}
          <div
            onClick={() => setActiveView('people')}
            className="group cursor-pointer bg-gradient-to-b from-[#0D161F] to-[#080D14] border border-[#26354A] hover:border-[#C5A059] p-6 space-y-4 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#F5DE98] uppercase tracking-[0.2em] border border-[#C5A059]/40 bg-[#07090D] px-2.5 py-1">
                  PEOPLE
                </span>
                <div className="w-8 h-8 border border-[#64A0E8]/30 bg-[#0A192F] flex items-center justify-center text-[#64A0E8] group-hover:border-[#C5A059] transition-colors">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                  People & Records
                </h3>
                <p className="text-xs text-[#A89F91] leading-relaxed font-reading">
                  Search and explore people, view biographical facts, check supporting sources, and add notes.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#C5A059] tracking-wider uppercase">
              <span>VIEW PEOPLE</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Card II: Lineage Trees */}
          <div
            onClick={() => setActiveView('trees')}
            className="group cursor-pointer bg-gradient-to-b from-[#0C1E18] to-[#07130F] border border-[#1B4336] hover:border-[#C5A059] p-6 space-y-4 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#52B395] uppercase tracking-[0.2em] border border-[#52B395]/40 bg-[#07090D] px-2.5 py-1">
                  TREES
                </span>
                <div className="w-8 h-8 border border-[#52B395]/30 bg-[#0B221B] flex items-center justify-center text-[#52B395] group-hover:border-[#C5A059] transition-colors">
                  <FolderTree className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                  Family Trees
                </h3>
                <p className="text-xs text-[#A89F91] leading-relaxed font-reading">
                  Manage multiple trees, invite family collaborators, and control privacy for relative discovery.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#52B395] tracking-wider uppercase">
              <span>VIEW TREES</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Card III: Duplicate Resolution */}
          <div
            onClick={() => setActiveView('duplicate_review')}
            className="group cursor-pointer bg-gradient-to-b from-[#1C0D15] to-[#12070D] border border-[#481E2E] hover:border-[#C5A059] p-6 space-y-4 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#D9658B] uppercase tracking-[0.2em] border border-[#D9658B]/40 bg-[#07090D] px-2.5 py-1">
                  DUPLICATES
                </span>
                <div className="w-8 h-8 border border-[#D9658B]/30 bg-[#240B13] flex items-center justify-center text-[#D9658B] group-hover:border-[#C5A059] transition-colors">
                  <GitMerge className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                  Review Duplicates
                </h3>
                <p className="text-xs text-[#A89F91] leading-relaxed font-reading">
                  Compare potential duplicate records side by side with similarity scores and merge them cleanly.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#D9658B] tracking-wider uppercase">
              <span>REVIEW DUPLICATES</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Card IV: Activity Log */}
          <div
            onClick={() => setActiveView('audit_log')}
            className="group cursor-pointer bg-gradient-to-b from-[#1B1912] to-[#100F0A] border border-[#4A3E26] hover:border-[#C5A059] p-6 space-y-4 transition-all duration-300 shadow-lg relative deco-corner-accent hover:-translate-y-1 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#C5A059] uppercase tracking-[0.2em] border border-[#C5A059]/40 bg-[#07090D] px-2.5 py-1">
                  HISTORY
                </span>
                <div className="w-8 h-8 border border-[#C5A059]/30 bg-[#1F190B] flex items-center justify-center text-[#C5A059] group-hover:border-[#F5DE98] transition-colors">
                  <History className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-deco font-bold text-[#F5DE98] group-hover:text-[#FFF0C2] transition-colors">
                  Activity Log
                </h3>
                <p className="text-xs text-[#A89F91] leading-relaxed font-reading">
                  Track every addition, relationship, document upload, and duplicate merge with full timestamped history.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#222B38] flex items-center justify-between text-xs font-deco font-semibold text-[#C5A059] tracking-wider uppercase">
              <span>VIEW ACTIVITY</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Demo Accounts Section */}
      <div className="border border-[#C5A059]/30 bg-[#0A0E15] p-7 sm:p-9 space-y-6 deco-corner-accent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222B38] pb-5">
          <div className="space-y-1">
            <h2 className="text-lg font-deco font-bold text-[#F5DE98] flex items-center gap-2.5">
              <UserCheck className="w-4 h-4 text-[#C5A059]" />
              <span>DEMO ACCOUNTS & SAMPLE DATA</span>
            </h2>
            <p className="text-xs text-[#A89F91] font-reading">
              Test different sample family trees below to see how records, permissions, and duplicate detection look in practice.
            </p>
          </div>
          <div className="text-xs font-mono text-[#F5DE98] bg-[#07090D] px-4 py-2 border border-[#C5A059]/40 shrink-0">
            ACTIVE DEMO: <span className="font-bold text-[#FFF0C2]">{activePersona.toUpperCase()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {demoPersonas.map((persona) => {
            const isActive = activePersona === persona.id;
            return (
              <div
                key={persona.id}
                onClick={() => switchDemoPersona(persona.id)}
                className={`p-4 border cursor-pointer transition-all ${
                  isActive
                    ? 'border-[#C5A059] bg-[#121924] shadow-md'
                    : 'border-[#222B38] bg-[#07090D] hover:border-[#C5A059]/50 hover:bg-[#0D1219]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-deco font-bold text-sm text-[#F5DE98]">
                    {persona.displayName}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-mono text-[#52B395] bg-[#0B221B] px-2 py-0.5 border border-[#1D5C4A]">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#E8DFD0] font-sans font-medium mb-1">
                  {persona.treeName}
                </div>
                <div className="text-[11px] text-[#A89F91] font-reading">
                  {persona.roleDescription}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
