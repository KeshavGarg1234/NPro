'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
  value: {
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  };
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({ children, value }) => {
  const memoizedValue = useMemo(() => value, [value.app, value.auth, value.firestore]);
  return <FirebaseContext.Provider value={memoizedValue}>{children}</FirebaseContext.Provider>;
};

export const useFirebase = (): Partial<FirebaseContextType> => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    return {};
  }
  return context;
};

export const useFirebaseApp = (): FirebaseApp => {
  const context = useContext(FirebaseContext);
  if (context === undefined || !context.app) {
    throw new Error('useFirebaseApp must be used within a FirebaseProvider');
  }
  return context.app;
};

export const useAuth = (): Auth => {
  const context = useContext(FirebaseContext);
  if (context === undefined || !context.auth) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context.auth;
};

export const useFirestore = (): Firestore => {
  const context = useContext(FirebaseContext);
  if (context === undefined || !context.firestore) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
  return context.firestore;
};
