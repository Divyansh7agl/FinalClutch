import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  UserCredential
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  signInWithGoogle: () => Promise<UserCredential>;
  signInWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<UserCredential>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async (): Promise<UserCredential> => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase Auth is not configured. Please set VITE_FIREBASE_* in .env.local');
    }
    return signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, pass: string): Promise<UserCredential> => {
    if (!auth) {
      throw new Error('Firebase Auth is not configured. Please set VITE_FIREBASE_* in .env.local');
    }
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    if (cred.user) {
      await cred.user.reload();
      setCurrentUser(Object.create(cred.user) as User);
    }
    return cred;
  };

  const signUpWithEmail = async (email: string, pass: string, displayName?: string): Promise<UserCredential> => {
    if (!auth) {
      throw new Error('Firebase Auth is not configured. Please set VITE_FIREBASE_* in .env.local');
    }
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    // Automatically send verification email upon sign up
    if (cred.user) {
      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        console.warn('[Auth] Failed to send initial verification email:', err);
      }
      await cred.user.reload();
      setCurrentUser(Object.create(cred.user) as User);
    }
    return cred;
  };

  const sendVerificationEmail = async (): Promise<void> => {
    if (!auth?.currentUser) {
      throw new Error('No user is currently signed in.');
    }
    await sendEmailVerification(auth.currentUser);
  };

  const reloadUser = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    // Update local state with prototype delegation so React detects the update while keeping all getters intact
    const updated = auth.currentUser;
    setCurrentUser(Object.create(updated) as User);
    return Boolean(updated?.emailVerified);
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    if (!auth) {
      throw new Error('Firebase Auth is not configured. Please set VITE_FIREBASE_* in .env.local');
    }
    await sendPasswordResetEmail(auth, email.trim());
  };

  const logout = async (): Promise<void> => {
    if (!auth) return;
    await signOut(auth);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isFirebaseConfigured,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendVerificationEmail,
        reloadUser,
        sendPasswordReset,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
