'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { useAuth } from '../provider';

interface UseUser {
  user: User | null;
  loading: boolean;
}

export const useUser = (): UseUser => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        // If no user, sign in anonymously for this demo app
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
          setUser(null);
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
};
