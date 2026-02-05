'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, Query, DocumentData, SnapshotOptions } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UseCollection<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

export const useCollection = <T extends DocumentData>(q: Query | null, options?: SnapshotOptions): UseCollection<T> => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const queryKey = useMemo(() => q ? JSON.stringify(q) : null, [q]);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const collectionData: T[] = [];
      querySnapshot.forEach((doc) => {
        collectionData.push({ id: doc.id, ...doc.data(options) } as T);
      });
      setData(collectionData);
      setLoading(false);
    }, (serverError) => {
      setError(serverError);
      setLoading(false);
      const permissionError = new FirestorePermissionError({
        path: q.toString(), // This is not perfect but gives some context
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [queryKey]); // Use memoized key

  return { data, loading, error };
};
