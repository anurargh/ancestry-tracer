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
} from 'lucide-react';

interface HeaderProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeView, setActiveView }) => {
  const {
    user,
    dbUser,
    loading,
    activePersona,
    demoPersonas,
    switchDemoPersona,
    signInWithGoogle,
    signOutUser,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { view: ActiveView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { view: 'landing', label: 'Overview', icon: Home },
    { view: 'people', label: 'People & Graph', icon: Users },
    { view: 'trees', label: 'Trees & RBAC', icon: FolderTree },
    { view: 'duplicate_review', label: 'Duplicate Resolution', icon: GitMerge },
    { view: 'audit_log', label: 'Audit Trail', icon: History },
    { view: 'about', label: 'About Architecture', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 bg-stone-900 border-b border-stone-800 text-stone-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            id="brand-logo-btn"
            onClick={() => setActiveView('landing')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-stone-100 flex items-center gap-1.5">
                FamilyGraph
              </span>
              <span className="text-xs text-stone-400 block -mt-1 font-mono">
                PostgreSQL Engine
              </span>
            </div>
          </button>

          {/* Navigation Links Desktop */}
          <nav className="hidden lg:flex items-center gap-1 ml-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  id={`nav-${item.view}-btn`}
                  onClick={() => setActiveView(item.view)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Database & Auth Actions */}
        <div className="flex items-center gap-3">
          {/* Cloud SQL Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <Database className="w-3.5 h-3.5" />
            <span>Cloud SQL</span>
          </div>

          {/* Demo Persona Switcher */}
          <div className="hidden md:flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-xl px-2 py-1 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={activePersona}
              onChange={(e) => {
                if (e.target.value === 'google') {
                  signInWithGoogle();
                } else {
                  switchDemoPersona(e.target.value as any);
                }
              }}
              className="bg-transparent text-stone-200 focus:outline-none cursor-pointer font-medium text-xs pr-1"
            >
              {demoPersonas.map((p) => (
                <option key={p.id} value={p.id} className="bg-stone-900 text-stone-200">
                  {p.displayName} ({p.treeName})
                </option>
              ))}
              <option value="google" className="bg-stone-900 text-amber-300 font-semibold">
                + Sign in with Google Account
              </option>
            </select>
          </div>

          {loading ? (
            <div className="w-8 h-8 rounded-full border-2 border-stone-700 border-t-amber-400 animate-spin"></div>
          ) : user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {'photoURL' in user && user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-stone-700 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-xs flex items-center justify-center border border-amber-500/30">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-medium text-stone-200 leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono flex items-center gap-1">
                    <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
                    <span>UID: {user.uid.replace('user-', '')}</span>
                  </div>
                </div>
              </div>

              {activePersona === 'google' && (
                <button
                  id="sign-out-btn"
                  onClick={signOutUser}
                  title="Sign out"
                  className="p-2 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              id="google-sign-in-btn"
              onClick={signInWithGoogle}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium px-3.5 py-1.5 rounded-lg text-sm transition-all shadow-sm active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in with Google</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-800 bg-stone-950 p-4 space-y-1">
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
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'text-stone-300 hover:text-stone-100 hover:bg-stone-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
