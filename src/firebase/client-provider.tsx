'use client';

import React, { useMemo } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './config';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const firebaseInstances = useMemo(() => {
    return initializeFirebase();
  }, []);

  return <FirebaseProvider value={firebaseInstances}>{children}</FirebaseProvider>;
}
