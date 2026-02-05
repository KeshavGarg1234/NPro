import { CreateRoomButton } from '@/components/synctube/create-room-button';
import { JoinRoomForm } from '@/components/synctube/join-room-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Youtube } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/60 backdrop-blur-sm border-white/20">
        <CardHeader className="items-center text-center">
          <div className="p-3 rounded-full bg-primary/20 mb-4 border border-primary/50">
            <Youtube className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tighter">
            SyncTube
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Watch. Listen. Together.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <p className="text-center text-muted-foreground">
            Create a private room and enjoy synchronized YouTube playback with friends.
          </p>
          <CreateRoomButton />
          <div className="flex w-full items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>
          <JoinRoomForm />
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground/50">
        Built for real-time connection.
      </footer>
    </main>
  );
}
