import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ActiveView } from '../types.ts';
import {
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
  Key,
  ShieldCheck,
  ChevronDown,
  UserPlus,
} from 'lucide-react';

interface HeaderProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeView, setActiveView }) => {
  const {
    user,
    isRealUser,
    loginProvider,
    loading,
    activePersona,
    demoPersonas,
    switchDemoPersona,
    openAuthModal,
    signOutUser,
  } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close account menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { view: ActiveView; label: string; sub: string; icon: React.FC<{ className?: string }> }[] = [
    { view: 'landing', label: 'Home', sub: 'Dashboard', icon: Home },
    { view: 'people', label: 'People', sub: 'Directory', icon: Users },
    { view: 'trees', label: 'Family Trees', sub: 'Lineages', icon: FolderTree },
    { view: 'duplicate_review', label: 'Duplicates', sub: 'Review', icon: GitMerge },
    { view: 'audit_log', label: 'Activity Log', sub: 'History', icon: History },
    { view: 'about', label: 'About', sub: 'Overview', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0A0E15]/95 backdrop-blur-md border-b border-[#C5A059]/30 text-[#E8DFD0] shadow-xl">
      {/* Art Deco Gilded Top Line Accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C5A059] to-transparent opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Plaque */}
        <div className="flex items-center gap-6">
          <button
            id="brand-logo-btn"
            onClick={() => setActiveView('landing')}
            className="flex items-center gap-3.5 text-left group focus-visible:ring-1 focus-visible:ring-[#C5A059] focus:outline-none py-1 pr-3 transition-transform duration-300 hover:scale-[1.02]"
          >
            {/* Geometric Brass Medallion */}
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
                FAMILY TREE PLATFORM
              </div>
            </div>
          </button>

          {/* Symmetrical Navigation */}
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

                  {/* Tab Underline Accent */}
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

        {/* Database & User Authentication Controls */}
        <div className="flex items-center gap-3">
          {/* Cloud SQL PostgreSQL Inscribed Plaque */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 border border-[#1D5C4A]/60 bg-[#0B221B]/80 text-[#52B395] text-[10px] font-mono tracking-wider shadow-inner">
            <span className="w-1.5 h-1.5 bg-[#52B395] animate-pulse"></span>
            <Database className="w-3.5 h-3.5 text-[#52B395]" />
            <span className="text-[#A89F91]">POSTGRESQL CONNECTED</span>
          </div>

          {loading ? (
            <div className="w-8 h-8 border-2 border-[#222B38] border-t-[#C5A059] animate-spin"></div>
          ) : isRealUser && user ? (
            /* REAL AUTHENTICATED USER */
            <div className="relative" ref={accountMenuRef}>
              <button
                id="user-account-dropdown-btn"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2.5 bg-[#0D1219] hover:bg-[#141B24] border border-[#C5A059]/60 hover:border-[#C5A059] p-1.5 pr-3 transition-all shadow-sm"
              >
                {'photoURL' in user && user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 border border-[#C5A059]/70 object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 border border-[#C5A059] bg-[#0E1520] text-[#F5DE98] font-deco font-bold text-xs flex items-center justify-center shadow-inner">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-deco font-semibold text-[#F5DE98] leading-tight flex items-center gap-1.5">
                    <span>{user.displayName || user.email?.split('@')[0]}</span>
                    {loginProvider === 'google.com' ? (
                      <span className="text-[9px] px-1 py-0.2 bg-[#4285F4]/20 text-[#6BA5FF] border border-[#4285F4]/40 font-mono">
                        Google
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 bg-[#C5A059]/20 text-[#F5DE98] border border-[#C5A059]/40 font-mono">
                        Email
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-[#A89F91] font-mono tracking-widest uppercase">
                    USER ID: #{user.uid.slice(0, 8)}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#C5A059]" />
              </button>

              {/* Account Dropdown Menu */}
              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0C1017] border-2 border-[#C5A059]/60 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 p-4 space-y-3 font-sans">
                  <div className="border-b border-[#C5A059]/30 pb-3">
                    <div className="text-[10px] font-mono text-[#C5A059] tracking-widest uppercase">
                      SIGNED IN AS
                    </div>
                    <div className="font-deco font-bold text-[#F5DE98] text-sm mt-0.5 truncate">
                      {user.displayName || 'User'}
                    </div>
                    <div className="text-xs text-[#A89F91] font-mono truncate">{user.email}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#52B395] font-mono">
                      <ShieldCheck className="w-3 h-3 text-[#52B395]" />
                      <span>Persistent Session Active</span>
                    </div>
                  </div>

                  {/* Switch to Sample Demo Personas */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono text-[#8C8275] uppercase tracking-wider">
                      Demo Accounts:
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {demoPersonas.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            switchDemoPersona(p.id);
                            setAccountMenuOpen(false);
                          }}
                          className="px-2 py-1 text-[10px] font-deco text-[#EDE7DF] bg-[#141B26] hover:bg-[#1E293B] border border-[#C5A059]/30 hover:border-[#C5A059] truncate"
                          title={p.displayName}
                        >
                          {p.displayName.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#C5A059]/25 flex items-center justify-between">
                    <button
                      id="account-sign-out-btn"
                      onClick={() => {
                        signOutUser();
                        setAccountMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#1A1112] hover:bg-[#2B1113] text-[#FFA8A8] border border-[#E05252]/40 hover:border-[#E05252] text-xs font-deco font-semibold tracking-wider transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>SIGN OUT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* DEMO / GUEST USER - Show Persona Switcher AND Sign In / Register Buttons */
            <div className="flex items-center gap-2">
              {/* Persona Switcher for Sample Archive Exploration */}
              <div className="hidden md:flex items-center gap-2 bg-[#0D1219] border border-[#C5A059]/40 px-3 py-1.5 text-xs shadow-sm hover:border-[#C5A059] transition-colors">
                <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
                <select
                  value={activePersona === 'real' ? 'alice' : activePersona}
                  onChange={(e) => switchDemoPersona(e.target.value as any)}
                  className="bg-transparent text-[#F5DE98] focus:outline-none cursor-pointer text-xs font-deco font-medium pr-1 tracking-wide"
                >
                  {demoPersonas.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0D1219] text-[#E8DFD0]">
                      ✦ Demo: {p.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sign In Button */}
              <button
                id="header-sign-in-btn"
                onClick={() => openAuthModal('signin')}
                className="hidden sm:inline-flex items-center gap-1.5 bg-[#0D1219] hover:bg-[#141B26] text-[#EDE7DF] border border-[#C5A059]/50 hover:border-[#C5A059] font-deco font-semibold tracking-wider px-3 py-1.5 text-xs transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>SIGN IN</span>
              </button>

              {/* Register Button */}
              <button
                id="header-register-btn"
                onClick={() => openAuthModal('register')}
                className="flex items-center gap-2 bg-gradient-to-r from-[#C5A059] via-[#E2BA6E] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold tracking-wider px-3.5 py-1.5 text-xs transition-all shadow-[0_0_15px_rgba(197,160,89,0.3)] active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#07090D]" />
                <span>REGISTER</span>
              </button>
            </div>
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
        <div className="lg:hidden border-t border-[#C5A059]/30 bg-[#07090D] p-5 space-y-3">
          {/* Mobile Auth Status Banner */}
          <div className="p-3 bg-[#0E1520] border border-[#C5A059]/30 flex items-center justify-between">
            {isRealUser && user ? (
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="text-[10px] font-mono text-[#C5A059] uppercase">Logged In As</div>
                  <div className="text-xs font-deco font-bold text-[#F5DE98]">{user.displayName || user.email}</div>
                </div>
                <button
                  onClick={signOutUser}
                  className="px-2.5 py-1 text-xs bg-[#2B1113] text-[#FFA8A8] border border-[#E05252]/40"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => {
                    openAuthModal('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 text-center text-xs font-deco font-semibold bg-[#141B26] text-[#EDE7DF] border border-[#C5A059]/40"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    openAuthModal('register');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 text-center text-xs font-deco font-bold bg-[#C5A059] text-[#07090D]"
                >
                  Register
                </button>
              </div>
            )}
          </div>

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
