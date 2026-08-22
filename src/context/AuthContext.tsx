import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
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

interface AuthContextType {
  user: FirebaseUser | { uid: string; email: string | null; displayName: string | null; photoURL?: string | null } | null;
  dbUser: DbUser | null;
  loading: boolean;
  error: string | null;
  activePersona: DemoPersonaId | 'google';
  demoPersonas: DemoPersona[];
  switchDemoPersona: (personaId: DemoPersonaId) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [activePersona, setActivePersona] = useState<DemoPersonaId | 'google'>('alice');
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentDemo = DEMO_PERSONAS.find((p) => p.id === activePersona) || DEMO_PERSONAS[0];

  const user = activePersona === 'google' && firebaseUser
    ? firebaseUser
    : {
        uid: currentDemo.uid,
        email: currentDemo.email,
        displayName: currentDemo.displayName,
        photoURL: null,
      };

  const getIdToken = async (): Promise<string | null> => {
    if (activePersona === 'google' && auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch (err) {
        console.error('Failed to get ID token:', err);
        return null;
      }
    }
    return currentDemo.uid;
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
      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          displayName: u.displayName || '',
          photoURL: u.photoURL || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (err: any) {
      console.error('Failed to sync user with PostgreSQL:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        setActivePersona('google');
        await syncUserWithBackend(currentUser);
      } else {
        // Default to demo persona Alice if not signed in with Google
        setActivePersona('alice');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const switchDemoPersona = async (personaId: DemoPersonaId) => {
    setActivePersona(personaId);
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

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        setActivePersona('google');
        await syncUserWithBackend(result.user);
      }
    } catch (err: any) {
      console.error('Error during Google Sign In:', err);
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setActivePersona('alice');
      setDbUser(null);
    } catch (err: any) {
      console.error('Error during Sign Out:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        loading,
        error,
        activePersona,
        demoPersonas: DEMO_PERSONAS,
        switchDemoPersona,
        signInWithGoogle,
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
