'use client';

import { useEffect, useRef, useState } from 'react';
import { Youtube, Loader2, PlayCircle } from 'lucide-react';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

type YouTubePlayerProps = {
  videoId: string | null;
  onStateChange: (event: any) => void;
  playerRef: React.MutableRefObject<any>;
  onReady: () => void;
  isPlaying: boolean;
  timestamp: number;
  isHost: boolean;
};

let apiLoadedPromise: Promise<void> | null = null;
const loadYouTubeAPI = () => {
  if (!apiLoadedPromise) {
    apiLoadedPromise = new Promise((resolve) => {
      if (typeof window === 'undefined') return;

      if (window.YT && window.YT.Player) {
        return resolve();
      }

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      window.onYouTubeIframeAPIReady = () => {
        resolve();
      };
      document.body.appendChild(script);
    });
  }
  return apiLoadedPromise;
};

export function YouTubePlayer({ videoId, onStateChange, playerRef, onReady, isPlaying, timestamp, isHost }: YouTubePlayerProps) {
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlayerInstanceReady, setIsPlayerInstanceReady] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  
  useEffect(() => {
    loadYouTubeAPI().then(() => setIsApiReady(true));
  }, []);

  useEffect(() => {
    if (!isApiReady || !playerContainerRef.current) {
      return;
    }

    new window.YT.Player(playerContainerRef.current, {
      videoId: videoId || '',
      playerVars: {
        playsinline: 1,
        autoplay: 0,
        controls: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
        disablekb: 0,
      },
      events: {
        onReady: (event: any) => {
          playerRef.current = event.target;
          setIsPlayerInstanceReady(true);
          onReadyRef.current();
        },
        onStateChange: (event: any) => onStateChangeRef.current(event),
      },
    });

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
          playerRef.current = null;
      }
      setIsPlayerInstanceReady(false);
    };
  }, [isApiReady, playerRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isPlayerInstanceReady || typeof player.loadVideoById !== 'function' || !videoId) {
      return;
    }

    const currentVideoUrl = player.getVideoUrl();
    const currentVideoId = currentVideoUrl && new URL(currentVideoUrl).searchParams.get('v');
    
    if (currentVideoId !== videoId) {
      player.loadVideoById(videoId || '');
    }
  }, [videoId, isPlayerInstanceReady, playerRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isPlayerInstanceReady || typeof player.getPlayerState !== 'function') {
      return;
    }
    
    const playerState = player.getPlayerState();
    
    if (!isPlaying && playerState === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } 
    else if (isPlaying && playerState !== window.YT.PlayerState.PLAYING) {
        player.playVideo();
    }
  }, [isPlaying, isPlayerInstanceReady, playerRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (isHost || !player || !isPlayerInstanceReady || typeof player.getCurrentTime !== 'function') {
      return;
    }
    
    const clientTime = player.getCurrentTime();
    const serverTime = timestamp;

    if (Math.abs(clientTime - serverTime) > 2.5) {
      player.seekTo(serverTime, true);
    }
  }, [timestamp, isHost, isPlayerInstanceReady, playerRef]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <div 
        ref={playerContainerRef} 
        className="absolute inset-0 w-full h-full"
      />

      {!videoId && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-zinc-900 z-10">
          <div className="p-6 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-pulse">
            <PlayCircle className="h-16 w-16 text-primary/60" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">SyncTube Player</h2>
          <p className="mt-2 text-muted-foreground">Waiting for host to play a video...</p>
        </div>
      )}
      {videoId && !isPlayerInstanceReady && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-black pointer-events-none z-20">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="mt-4 text-lg text-muted-foreground font-medium">Loading session...</p>
        </div>
      )}
    </div>
  );
}
