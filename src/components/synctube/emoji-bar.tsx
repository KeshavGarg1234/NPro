'use client';

import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const EMOJIS = ['❤️', '😂', '😢', '🤔', '👍', '🎉'];

export function EmojiBar({ roomId, disabled }: { roomId: string, disabled: boolean }) {
  const firestore = useFirestore();
  const { user } = useUser();

  const handleEmojiClick = (emoji: string) => {
    if (!firestore || !user) return;

    const reactionsRef = collection(firestore, `rooms/${roomId}/reactions`);
    const reactionData = {
      emoji,
      userId: user.uid,
      timestamp: serverTimestamp(),
    };
    
    addDoc(reactionsRef, reactionData).catch((serverError) => {
      const permissionError = new FirestorePermissionError({
        path: reactionsRef.path,
        operation: 'create',
        requestResourceData: reactionData,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  return (
    <TooltipProvider>
      <div className="flex justify-around items-center p-2 border-t bg-background/50">
        {EMOJIS.map((emoji) => (
            <Tooltip key={emoji}>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => handleEmojiClick(emoji)}
                        disabled={disabled}
                        className={cn(
                            "text-2xl p-2 rounded-full transition-transform transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                        aria-label={`React with ${emoji}`}
                    >
                        {emoji}
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>React with {emoji}</p>
                </TooltipContent>
            </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
