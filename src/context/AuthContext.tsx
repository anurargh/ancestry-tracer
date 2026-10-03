import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { DbUser } from '../types.ts';

export type DemoPersonaId = 'alice' | 'david' | 'elena';

export interface DemoPersona {
  id: DemoPersonaId;
  uid: string;
  email: string;
  displayName: string;
  treeName: string;
  roleDescription: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'alice',
    uid: 'user-alice-pemberton',
    email: 'alice.pemberton@example.com',
    displayName: 'Alice Pemberton',
    treeName: 'Pemberton Heritage Tree',
    roleDescription: 'Owner of Pemberton Lineage (Generations 1–4)',
  },
  {
    id: 'david',
    uid: 'user-david-montgomery',
    email: 'david.montgomery@example.com',
    displayName: 'David Montgomery',
    treeName: 'Montgomery Family Lineage',
    roleDescription: 'Owner of Montgomery Branch (Discovery & Duplicates)',
  },
  {
    id: 'elena',
    uid: 'user-elena-thorne',
    email: 'elena.thorne@example.com',
    displayName: 'Elena Thorne',
    treeName: 'Thorne Family Record',
    roleDescription: 'Owner of Thorne Record (Pedigree collapse & Cross-tree)',
  },
];

export type AuthMode = 'authenticated' | 'demo' | 'guest';
export type AuthModalTab = 'signin' | 'register' | 'forgot_password';

export interface AuthErrorDetails {
  message: string;
  code?: string;
  isFirebaseConsoleNotice?: boolean;
  isUnauthorizedDomainNotice?: boolean;
  unauthorizedDomain?: string;
}

export function parseAuthError(error: any): AuthErrorDetails {
  const code = error?.code || '';
  switch (code) {
    case 'auth/unauthorized-domain': {
      const domain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      return {
        code: 'auth/unauthorized-domain',
        message: `Domain not authorized for Google Sign-In (${domain}).`,
        isUnauthorizedDomainNotice: true,
        unauthorizedDomain: domain,
      };
    }
    case 'auth/operation-not-allowed':
      return {
        code: 'auth/operation-not-allowed',
        message: 'Email/Password sign-in has not been enabled in the Firebase Console for this project. Please enable Email/Password under Authentication > Sign-in method.',
        isFirebaseConsoleNotice: true,
      };
    case 'auth/email-already-in-use':
      return {
        code: 'auth/email-already-in-use',
        message: 'An account with this email address already exists. Please switch to Sign In or use Google Sign-In.',
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return {
        code: code,
        message: 'Incorrect email or password. Please verify your credentials or use Forgot Password.',
      };
    case 'auth/user-not-found':
      return {
        code: 'auth/user-not-found',
        message: 'No account found with this email. Please check the spelling or create a new account under the Register tab.',
      };
    case 'auth/weak-password':
      return {
        code: 'auth/weak-password',
        message: 'Password is too weak. Please use at least 6 characters.',
      };
    case 'auth/invalid-email':
      return {
        code: 'auth/invalid-email',
        message: 'Please enter a valid email address.',
      };
    case 'auth/popup-closed-by-user':
      return {
        code: 'auth/popup-closed-by-user',
        message: 'Google Sign-In popup was closed before completion. Please try again.',
      };
    case 'auth/popup-blocked':
      return {
        code: 'auth/popup-blocked',
        message: 'The Google Sign-In popup was blocked by your browser. Please allow popups for this site.',
      };
    case 'auth/too-many-requests':
      return {
        code: 'auth/too-many-requests',
        message: 'Access temporarily disabled due to multiple failed login attempts. Please reset your password or try again later.',
      };
    case 'auth/account-exists-with-different-credential':
      return {
        code: 'auth/account-exists-with-different-credential',
        message: 'An account already exists with this email address using another sign-in method. Please sign in with that method.',
      };
    case 'auth/network-request-failed':
      return {
        code: 'auth/network-request-failed',
        message: 'Network connection error. Please verify your connection and try again.',
      };
    default:
      return {
        code: code,
        message: error?.message || 'Authentication encountered an error. Please try again.',
      };
  }
}

interface AuthContextType {
  user: FirebaseUser | { uid: string; email: string | null; displayName: string | null; photoURL?: string | null } | null;
  firebaseUser: FirebaseUser | null;
  directUser: { uid: string; email: string; displayName: string } | null;
  dbUser: DbUser | null;
  loading: boolean;
  error: string | null;
  errorDetails: AuthErrorDetails | null;
  authMode: AuthMode;
  isRealUser: boolean;
  activePersona: DemoPersonaId | 'real';
  demoPersonas: DemoPersona[];
  loginProvider: 'google.com' | 'password' | 'direct' | 'demo' | null;
  authModalOpen: boolean;
  authModalTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  switchDemoPersona: (personaId: DemoPersonaId) => Promise<void>;
  activateDemoMode: (personaId?: DemoPersonaId) => void;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  signInWithDirectAccount: (email: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [directUser, setDirectUser] = useState<{ uid: string; email: string; displayName: string } | null>(null);
  const [activePersona, setActivePersona] = useState<DemoPersonaId | 'real'>('real');
  const [demoSelectedPersona, setDemoSelectedPersona] = useState<DemoPersonaId>('alice');
  const [authMode, setAuthMode] = useState<AuthMode>('guest');
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<AuthErrorDetails | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>('signin');

  const currentDemo = DEMO_PERSONAS.find((p) => p.id === demoSelectedPersona) || DEMO_PERSONAS[0];

  // User object exposed to components: real Firebase User if logged in, direct account if created, or demo persona
  const user = firebaseUser
    ? firebaseUser
    : directUser
    ? {
        uid: directUser.uid,
        email: directUser.email,
        displayName: directUser.displayName,
        photoURL: null,
      }
    : authMode === 'demo'
    ? {
        uid: currentDemo.uid,
        email: currentDemo.email,
        displayName: currentDemo.displayName,
        photoURL: null,
      }
    : null;

  const isRealUser = !!firebaseUser || !!directUser;

  const loginProvider: 'google.com' | 'password' | 'direct' | 'demo' | null = firebaseUser
    ? (firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password')
    : directUser
    ? 'direct'
    : authMode === 'demo'
    ? 'demo'
    : null;

  const openAuthModal = useCallback((tab: AuthModalTab = 'signin') => {
    setError(null);
    setErrorDetails(null);
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const getIdToken = async (): Promise<string | null> => {
    if (firebaseUser) {
      try {
        return await firebaseUser.getIdToken();
      } catch (err) {
        console.error('Failed to get Firebase ID token:', err);
        return null;
      }
    }
    if (directUser) {
      return directUser.uid;
    }
    if (authMode === 'demo') {
      return currentDemo.uid;
    }
    return currentDemo?.uid || 'user-alice-pemberton';
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const token = await getIdToken();
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const syncUserWithBackend = async (u: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }) => {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      } else {
        token = u.uid;
      }

      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: u.displayName || u.email?.split('@')[0] || 'Genealogist',
          photoURL: u.photoURL || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (err: any) {
      console.error('Failed to sync user with database:', err);
    }
  };

  // Firebase auth state listener: automatically restores saved session on refresh
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        setDirectUser(null);
        setActivePersona('real');
        setAuthMode('authenticated');
        await syncUserWithBackend(currentUser);
      } else {
        // Check for saved direct user session first
        const savedDirect = localStorage.getItem('familygraph_direct_user');
        if (savedDirect) {
          try {
            const parsed = JSON.parse(savedDirect);
            if (parsed && parsed.uid && parsed.email) {
              setDirectUser(parsed);
              setActivePersona('real');
              setAuthMode('authenticated');
              await syncUserWithBackend(parsed);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse direct user session:', e);
          }
        }

        // If not logged in, check if user was using demo mode previously
        const savedDemo = localStorage.getItem('familygraph_demo_persona');
        if (savedDemo && ['alice', 'david', 'elena'].includes(savedDemo)) {
          setDemoSelectedPersona(savedDemo as DemoPersonaId);
          setActivePersona(savedDemo as DemoPersonaId);
          setAuthMode('demo');
        } else {
          // Default to demo mode for initial visitor exploration
          setActivePersona('alice');
          setDemoSelectedPersona('alice');
          setAuthMode('demo');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithDirectAccount = async (
    userEmail: string,
    userName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setErrorDetails(null);
    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const cleanName = userName?.trim() || cleanEmail.split('@')[0];
      const safeUid = 'user-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '-');

      const profile = {
        uid: safeUid,
        email: cleanEmail,
        displayName: cleanName,
      };

      setDirectUser(profile);
      setFirebaseUser(null);
      setActivePersona('real');
      setAuthMode('authenticated');
      localStorage.setItem('familygraph_direct_user', JSON.stringify(profile));
      localStorage.removeItem('familygraph_demo_persona');

      await syncUserWithBackend({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: null,
      });

      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      console.error('Direct sign in error:', err);
      return { success: false, error: err.message || 'Failed to sign in' };
    }
  };

  const switchDemoPersona = async (personaId: DemoPersonaId) => {
    setDemoSelectedPersona(personaId);
    setActivePersona(personaId);
    setAuthMode('demo');
    localStorage.setItem('familygraph_demo_persona', personaId);
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId) || DEMO_PERSONAS[0];
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${persona.uid}`,
        },
        body: JSON.stringify({
          displayName: persona.displayName,
          photoURL: '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (err) {
      console.error('Error switching demo persona:', err);
    }
  };

  const activateDemoMode = (personaId: DemoPersonaId = 'alice') => {
    switchDemoPersona(personaId);
  };

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setErrorDetails(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        setFirebaseUser(result.user);
        setActivePersona('real');
        setAuthMode('authenticated');
        localStorage.removeItem('familygraph_demo_persona');
        await syncUserWithBackend(result.user);
        setAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: 'Sign in cancelled' };
    } catch (err: any) {
      console.error('Error during Google Sign In:', err);
      const parsed = parseAuthError(err);
      setError(parsed.message);
      setErrorDetails(parsed);
      return { success: false, error: parsed.message };
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setErrorDetails(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        setFirebaseUser(result.user);
        setActivePersona('real');
        setAuthMode('authenticated');
        localStorage.removeItem('familygraph_demo_persona');
        await syncUserWithBackend(result.user);
        setAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: 'Authentication failed' };
    } catch (err: any) {
      console.error('Error during Email Sign In:', err);
      const parsed = parseAuthError(err);
      setError(parsed.message);
      setErrorDetails(parsed);
      return { success: false, error: parsed.message };
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setErrorDetails(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        // Update display name in Firebase Auth
        if (displayName.trim()) {
          try {
            await updateProfile(result.user, {
              displayName: displayName.trim(),
            });
          } catch (profileErr) {
            console.warn('Could not update profile display name:', profileErr);
          }
        }

        setFirebaseUser(result.user);
        setActivePersona('real');
        setAuthMode('authenticated');
        localStorage.removeItem('familygraph_demo_persona');
        await syncUserWithBackend({
          uid: result.user.uid,
          email: result.user.email,
          displayName: displayName.trim() || result.user.email?.split('@')[0],
          photoURL: null,
        });
        setAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err: any) {
      console.error('Error during Email Registration:', err);
      const parsed = parseAuthError(err);
      setError(parsed.message);
      setErrorDetails(parsed);
      return { success: false, error: parsed.message };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setErrorDetails(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err: any) {
      console.error('Error sending password reset email:', err);
      const parsed = parseAuthError(err);
      setError(parsed.message);
      setErrorDetails(parsed);
      return { success: false, error: parsed.message };
    }
  };

  const signOutUser = async () => {
    try {
      localStorage.removeItem('familygraph_direct_user');
      setDirectUser(null);
      await signOut(auth);
      setFirebaseUser(null);
      setDbUser(null);
      // Return to demo mode or guest
      setActivePersona('alice');
      setDemoSelectedPersona('alice');
      setAuthMode('demo');
    } catch (err: any) {
      console.error('Error during Sign Out:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        directUser,
        dbUser,
        loading,
        error,
        errorDetails,
        authMode,
        isRealUser,
        activePersona,
        demoPersonas: DEMO_PERSONAS,
        loginProvider,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        switchDemoPersona,
        activateDemoMode,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        signInWithDirectAccount,
        sendPasswordReset,
        signOutUser,
        getIdToken,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
