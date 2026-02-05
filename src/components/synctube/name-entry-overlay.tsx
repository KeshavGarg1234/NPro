'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

export function NameEntryOverlay({ onNameSubmit }: { onNameSubmit: (name: string) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onNameSubmit(name.trim());
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/20 p-3 rounded-full mb-2">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Welcome to the Room!</CardTitle>
          <CardDescription>
            Please enter your name to join the chat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                required
                autoFocus
                className="text-center text-lg"
              />
            </div>
            <Button type="submit" disabled={!name.trim()} className="w-full">
              Join Room
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
