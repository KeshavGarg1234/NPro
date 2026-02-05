'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function JoinRoomForm() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  return (
    <form onSubmit={handleJoinRoom} className="w-full space-y-2">
        <label htmlFor="roomId" className="text-center block text-muted-foreground">
            Or join an existing room
        </label>
      <div className="flex w-full items-center space-x-2">
        <Input
          id="roomId"
          name="roomId"
          type="text"
          placeholder="Enter Room Code..."
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
          className="text-base"
        />
        <Button type="submit" variant="secondary">
          <LogIn className="mr-2 h-5 w-5" />
          Join
        </Button>
      </div>
    </form>
  );
}
