'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error('Caught Firestore Permission Error:', error);
      // In a real app, you might use a more sophisticated error reporting service.
      // For this demo, we'll use a toast notification.
      toast({
        variant: 'destructive',
        title: 'Permission Error',
        description: 'You do not have permission to perform this action.',
      });

      // This is a development-only feature to show the detailed error overlay.
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
