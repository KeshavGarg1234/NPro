'use client';

// This is the entry point for all client-side Firebase code.
// It exports the necessary providers and hooks.

export { initializeFirebase } from './config';
export { FirebaseProvider, useFirebase, useFirebaseApp, useAuth, useFirestore } from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
