'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { generateRoomId } from '@/lib/utils';
import { PartyPopper, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useUser } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function CreateRoomButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleCreateRoom = () => {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Cannot create room. User not authenticated.',
      });
      return;
    }

    setIsLoading(true);
    const roomId = generateRoomId();

    const roomRef = doc(firestore, 'rooms', roomId);
    const roomData = {
      roomId,
      hostId: user.uid,
      videoId: '', // Start empty as requested
      isPlaying: false,
      timestamp: 0,
      createdAt: serverTimestamp(),
      queue: [],
      currentQueueIndex: -1,
      repeat: false,
      userCount: 0,
      isLocked: false,
      isLiveDisabled: false,
    };
    
    setDoc(roomRef, roomData).catch((error: any) => {
      console.error('Error creating room in background:', error);
      const permissionError = new FirestorePermissionError({
          path: `/rooms/${roomId}`,
          operation: 'create',
          requestResourceData: { roomData }
      });
      errorEmitter.emit('permission-error', permissionError);
    });

    router.push(`/room/${roomId}`);
  };

  return (
    <Button
      size="lg"
      className="w-full font-bold text-lg"
      onClick={handleCreateRoom}
      disabled={isLoading || !user}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Creating Room...
        </>
      ) : (
        <>
          <PartyPopper className="mr-2 h-5 w-5" />
          Create a New Room
        </>
      )}
    </Button>
  );
}
