import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ActiveView } from '../types.ts';
import {
  Network,
  Users,
  Home,
  LogIn,
  LogOut,
  Database,
  UserCheck,
  GitMerge,
  FolderTree,
  History,
  BookOpen,
  Menu,
  X,
  Compass,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeView, setActiveView }) => {
  const {
    user,
    loading,
    activePersona,
    demoPersonas,
    switchDemoPersona,
    signInWithGoogle,
    signOutUser,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { view: ActiveView; label: string; sub: string; icon: React.FC<{ className?: string }> }[] = [
    { view: 'landing', label: 'Grand Archive', sub: 'Overview', icon: Home },
    { view: 'people', label: 'People Registry', sub: 'Evidence', icon: Users },
    { view: 'trees', label: 'Lineage Trees', sub: 'Pedigrees', icon: FolderTree },
    { view: 'duplicate_review', label: 'Record Linkage', sub: 'Duplicates', icon: GitMerge },
    { view: 'audit_log', label: 'Provenance', sub: 'Audit Trail', icon: History },
    { view: 'about', label: 'Architecture', sub: 'Monograph', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0A0E15]/95 backdrop-blur-md border-b border-[#C5A059]/30 text-[#E8DFD0] shadow-xl">
      {/* Art Deco Gilded Top Line Accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C5A059] to-transparent opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Institutional Art Deco Brand Plaque */}
        <div className="flex items-center gap-6">
          <button
            id="brand-logo-btn"
            onClick={() => setActiveView('landing')}
            className="flex items-center gap-3.5 text-left group focus-visible:ring-1 focus-visible:ring-[#C5A059] focus:outline-none py-1 pr-3 transition-transform duration-300 hover:scale-[1.02]"
          >
            {/* Art Deco Geometric Brass Medallion */}
            <div className="relative w-10 h-10 border border-[#C5A059] bg-[#0E1520] flex items-center justify-center text-[#F5DE98] shadow-[0_0_15px_rgba(197,160,89,0.2)] rotate-45 transition-transform group-hover:rotate-90 duration-500">
              <div className="absolute inset-1 border border-[#C5A059]/40 -rotate-45 flex items-center justify-center">
                <span className="font-display text-base font-black text-[#F5DE98]">❖</span>
              </div>
            </div>
            <div className="pl-1">
              <div className="font-deco font-bold text-lg tracking-[0.18em] text-[#F5DE98] flex items-center gap-2 leading-tight">
                <span>FAMILYGRAPH</span>
              </div>
              <div className="text-[9px] text-[#A89F91] tracking-[0.25em] uppercase font-mono mt-0.5">
                CANONICAL GENEALOGICAL REGISTRY
              </div>
            </div>
          </button>

          {/* Symmetrical Art Deco Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5 ml-2 border-l border-[#222B38] pl-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  id={`nav-${item.view}-btn`}
                  onClick={() => setActiveView(item.view)}
                  className={`relative px-3.5 py-2 text-left transition-all duration-300 group ${
                    isActive
                      ? 'text-[#F5DE98]'
                      : 'text-[#A89F91] hover:text-[#E8DFD0]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${isActive ? 'text-[#C5A059]' : 'text-[#6E675C]'}`} />
                    <div>
                      <div className="font-deco text-xs tracking-wider uppercase leading-none font-semibold">
                        {item.label}
                      </div>
                    </div>
                  </div>

                  {/* Art Deco Tab Underline & Diamond Accent */}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 flex flex-col items-center">
                      <span className="text-[8px] text-[#C5A059] leading-none mb-[-2px]">◆</span>
                      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Database & Vault Researcher Signet */}
        <div className="flex items-center gap-3">
          {/* Cloud SQL PostgreSQL Inscribed Plaque */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 border border-[#1D5C4A]/60 bg-[#0B221B]/80 text-[#52B395] text-[10px] font-mono tracking-wider shadow-inner">
            <span className="w-1.5 h-1.5 bg-[#52B395] animate-pulse"></span>
            <Database className="w-3.5 h-3.5 text-[#52B395]" />
            <span className="text-[#A89F91]">SQL VAULT CONNECTED</span>
          </div>

          {/* Researcher Persona Signet Switcher */}
          <div className="hidden md:flex items-center gap-2 bg-[#0D1219] border border-[#C5A059]/40 px-3 py-1.5 text-xs shadow-sm hover:border-[#C5A059] transition-colors">
            <UserCheck className="w-3.5 h-3.5 text-[#C5A059]" />
            <select
              value={activePersona}
              onChange={(e) => {
                if (e.target.value === 'google') {
                  signInWithGoogle();
                } else {
                  switchDemoPersona(e.target.value as any);
                }
              }}
              className="bg-transparent text-[#F5DE98] focus:outline-none cursor-pointer text-xs font-deco font-medium pr-1 tracking-wide"
            >
              {demoPersonas.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0D1219] text-[#E8DFD0]">
                  ✦ {p.displayName} — {p.treeName}
                </option>
              ))}
              <option value="google" className="bg-[#0D1219] text-[#C5A059] font-bold">
                ⚜ Sign in with Google Account
              </option>
            </select>
          </div>

          {loading ? (
            <div className="w-8 h-8 border-2 border-[#222B38] border-t-[#C5A059] animate-spin"></div>
          ) : user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2.5">
                {'photoURL' in user && user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 border border-[#C5A059]/70 object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 border border-[#C5A059] bg-[#0E1520] text-[#F5DE98] font-deco font-bold text-xs flex items-center justify-center shadow-inner">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'R'}
                  </div>
                )}
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-deco font-semibold text-[#F5DE98] leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[9px] text-[#A89F91] font-mono tracking-widest uppercase">
                    SEAL: #{user.uid.replace('user-', '').slice(0, 8)}
                  </div>
                </div>
              </div>

              {activePersona === 'google' && (
                <button
                  id="sign-out-btn"
                  onClick={signOutUser}
                  title="Sign out of Private Archive"
                  className="p-2 text-[#A89F91] hover:text-[#F5DE98] hover:bg-[#131A24] border border-transparent hover:border-[#C5A059]/40 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              id="google-sign-in-btn"
              onClick={signInWithGoogle}
              className="flex items-center gap-2 bg-gradient-to-r from-[#C5A059] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold tracking-wider px-4 py-1.5 text-xs transition-all shadow-[0_0_15px_rgba(197,160,89,0.3)] active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>ENTER VAULT</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#A89F91] hover:text-[#F5DE98] hover:bg-[#131A24] border border-[#222B38]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#C5A059]/30 bg-[#07090D] p-5 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  setActiveView(item.view);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between ${
                  isActive
                    ? 'bg-[#131A24] text-[#F5DE98] border-l-2 border-[#C5A059]'
                    : 'text-[#A89F91] hover:text-[#E8DFD0] hover:bg-[#0D1219]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[#C5A059]" />
                  <span className="font-deco text-xs uppercase tracking-wider font-semibold">{item.label}</span>
                </div>
                <span className="text-[10px] font-mono text-[#6E675C]">{item.sub}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

