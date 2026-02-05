'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, Timestamp, orderBy } from 'firebase/firestore';

type Reaction = {
  id: string;
  emoji: string;
  userId: string;
  timestamp: Timestamp;
};

type AnimatingReaction = Reaction & {
  // Use a unique id for the animation key, as a user might send the same emoji twice
  animationId: string;
  left: string;
  animationDuration: string;
  animationDelay: string;
};

let animationIdCounter = 0;

export function EmojiFlyout({ roomId }: { roomId: string }) {
  const firestore = useFirestore();
  const [animatingReactions, setAnimatingReactions] = useState<AnimatingReaction[]>([]);
  
  // Ref to store the timestamp of when the component mounted.
  const mountTimestamp = useRef(Timestamp.now());
  const processedReactionIds = useRef(new Set<string>());

  // Query for reactions that happened after this component mounted.
  const reactionsQuery = useMemo(() => {
    if (!firestore) return null;
    const reactionsRef = collection(firestore, `rooms/${roomId}/reactions`);
    return query(
      reactionsRef,
      where('timestamp', '>=', mountTimestamp.current),
      orderBy('timestamp', 'desc') // order to easily get the latest
    );
  }, [firestore, roomId]);

  const { data: newReactions } = useCollection<Reaction>(reactionsQuery);

  useEffect(() => {
    if (newReactions) {
      const reactionsToAnimate = newReactions.filter(
        reaction => !processedReactionIds.current.has(reaction.id)
      );

      if (reactionsToAnimate.length > 0) {
        reactionsToAnimate.forEach(r => processedReactionIds.current.add(r.id));
        
        const newAnimations: AnimatingReaction[] = reactionsToAnimate.flatMap(reaction => 
          // The user wants 2 or 3 balloons together. Let's do a random number between 2 and 3.
          Array.from({ length: Math.floor(Math.random() * 2) + 2 }).map(() => ({
            ...reaction,
            animationId: `${reaction.id}-${animationIdCounter++}`,
            left: `${Math.random() * 80 + 10}%`,
            animationDuration: `${Math.random() * 2 + 3}s`,
            animationDelay: `${Math.random() * 0.5}s`,
          }))
        );

        setAnimatingReactions(prev => [...prev, ...newAnimations]);
      }
    }
  }, [newReactions]);

  const handleAnimationEnd = (animationId: string) => {
    setAnimatingReactions(prev => prev.filter(r => r.animationId !== animationId));
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
      {animatingReactions.map(reaction => (
        <span
          key={reaction.animationId}
          className="emoji-animation"
          style={{
            left: reaction.left,
            animationDuration: reaction.animationDuration,
            animationDelay: reaction.animationDelay,
          }}
          onAnimationEnd={() => handleAnimationEnd(reaction.animationId)}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
