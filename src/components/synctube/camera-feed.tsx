
'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CameraOff, Mic, MicOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export function CameraFeed({ userName, roomId, onStreamReady }: { userName: string | null, roomId: string, onStreamReady: (stream: MediaStream | null) => void }) {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        setHasCameraPermission(true);
        streamRef.current = stream;
        onStreamReady(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera and microphone permissions in your browser settings to use live reactions.',
        });
      }
    };

    getCameraPermission();

    return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        onStreamReady(null);
    };
  }, [toast, onStreamReady]);

  // Sync controls to Firestore
  useEffect(() => {
    if (!firestore || !user || !roomId) return;
    const userRef = doc(firestore, 'rooms', roomId, 'users', user.uid);
    updateDoc(userRef, { isMuted, isVideoOff }).catch(() => {});
  }, [firestore, user, roomId, isMuted, isVideoOff]);

  const toggleMute = () => {
    if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoOff(!videoTrack.enabled);
        }
    }
  };

  return (
    <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Your Feed</span>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggleMute}>
                {isMuted ? <MicOff className="h-3.5 w-3.5 text-destructive" /> : <Mic className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggleVideo}>
                {isVideoOff ? <CameraOff className="h-3.5 w-3.5 text-destructive" /> : <Video className="h-3.5 w-3.5" />}
            </Button>
          </div>
      </div>

      <div className="relative aspect-video rounded-md overflow-hidden bg-black ring-1 ring-white/10">
        <video 
            ref={videoRef} 
            className={cn("w-full h-full object-cover scale-x-[-1]", isVideoOff && "hidden")} 
            autoPlay 
            muted={true}
            playsInline
        />
        {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                <div className="flex flex-col items-center gap-2">
                    <CameraOff className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground uppercase">{userName || 'You'} (Hidden)</span>
                </div>
            </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-medium text-white">
            Preview
        </div>
      </div>

      {hasCameraPermission === false && (
        <Alert variant="destructive" className="py-2 px-3">
          <AlertTitle className="text-xs">Access Required</AlertTitle>
          <AlertDescription className="text-[10px]">
            Please allow camera/mic access to join the live session.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
