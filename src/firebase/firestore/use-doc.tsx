'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, DocumentReference, DocumentData, SnapshotOptions } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UseDoc<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export const useDoc = <T extends DocumentData>(ref: DocumentReference | null, options?: SnapshotOptions): UseDoc<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const docPath = useMemo(() => ref?.path, [ref]);

  useEffect(() => {
    if (!docPath || !ref) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(ref, (doc) => {
      if (doc.exists()) {
        setData({ id: doc.id, ...doc.data(options) } as T);
      } else {
        setData(null);
      }
      setLoading(false);
    }, (serverError) => {
      setError(serverError);
      setLoading(false);
      const permissionError = new FirestorePermissionError({
        path: ref.path,
        operation: 'get',
      });
      errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [docPath]);

  return { data, loading, error };
};
