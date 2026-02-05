
'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useUser, useCollection } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MicOff, VideoOff, Lock, MoreVertical, Maximize2, Minimize2, Volume2, VolumeX, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type LiveUser = {
  id: string;
  name: string;
  avatar: string;
  isLive: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
};

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function LiveParticipants({ 
    roomId, 
    localStream, 
    isHost, 
    isLocalLive, 
    pinnedUserId, 
    localMutedUsers,
    onPinUser,
    onMuteUser,
    isExpandedView = false,
    isLiveDisabled = false,
    excludeUserId
}: { 
    roomId: string, 
    localStream: MediaStream | null, 
    isHost: boolean, 
    isLocalLive: boolean,
    pinnedUserId?: string | null,
    localMutedUsers?: string[],
    onPinUser?: (uid: string) => void,
    onMuteUser?: (uid: string) => void,
    isExpandedView?: boolean,
    isLiveDisabled?: boolean,
    excludeUserId?: string | null
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const usersRef = useMemo(() => firestore ? collection(firestore, 'rooms', roomId, 'users') : null, [firestore, roomId]);
  const liveUsersQuery = useMemo(() => usersRef ? query(usersRef, where('isLive', '==', true)) : null, [usersRef]);
  const { data: liveUsers } = useCollection<LiveUser>(liveUsersQuery);

  const canSeeReactions = isHost || isLocalLive;

  const displayUsers = useMemo(() => {
    if (isExpandedView) {
        return liveUsers?.filter(u => u.id === pinnedUserId) || [];
    }
    return liveUsers?.filter(u => u.id !== excludeUserId) || [];
  }, [liveUsers, isExpandedView, pinnedUserId, excludeUserId]);

  if (!canSeeReactions && !isExpandedView) {
    return (
        <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-zinc-950/40 min-h-[140px] flex flex-col items-center justify-center p-6 text-center shadow-inner my-2">
            <div className="bg-primary/10 p-3 rounded-full mb-3 ring-1 ring-primary/20">
                {isLiveDisabled ? <Lock className="h-6 w-6 text-destructive/80" /> : <Users className="h-6 w-6 text-primary/80" />}
            </div>
            <h3 className="text-base font-bold text-white mb-1">
                {isLiveDisabled ? "Live Reactions Restricted" : "Join the Live Session"}
            </h3>
            <p className="text-muted-foreground text-xs max-w-sm">
                {isLiveDisabled 
                    ? "The host has restricted live reactions. You cannot see others' feeds right now."
                    : "Turn on your camera in the chat sidebar to see and hear your friends' live reactions!"}
            </p>
        </div>
    );
  }

  if (displayUsers.length === 0 && !isExpandedView) {
    return null;
  }

  return (
    <div className={cn("relative", !isExpandedView && "mb-4")}>
      <div className={cn(
          isExpandedView ? "w-full h-full" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 transition-all",
      )}>
        {displayUsers.map((liveUser) => (
            <LiveUserCard 
                key={liveUser.id} 
                roomId={roomId}
                liveUser={liveUser} 
                isLocal={liveUser.id === user?.uid}
                localStream={localStream}
                isHost={isHost}
                localIsLive={isLocalLive}
                isPinned={pinnedUserId === liveUser.id}
                isLocalMuted={localMutedUsers?.includes(liveUser.id)}
                onPin={() => onPinUser?.(liveUser.id)}
                onMute={() => onMuteUser?.(liveUser.id)}
                isExpandedView={isExpandedView}
            />
        ))}
      </div>
    </div>
  );
}

function LiveUserCard({ 
    roomId, 
    liveUser, 
    isLocal, 
    localStream, 
    isHost, 
    localIsLive,
    isPinned,
    isLocalMuted,
    onPin,
    onMute,
    isExpandedView
}: { 
    roomId: string, 
    liveUser: LiveUser, 
    isLocal: boolean, 
    localStream: MediaStream | null, 
    isHost: boolean, 
    localIsLive: boolean,
    isPinned: boolean,
    isLocalMuted?: boolean,
    onPin: () => void,
    onMute: () => void,
    isExpandedView?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    if (isLocal) {
      if (localStream && videoRef.current) {
        videoRef.current.srcObject = localStream;
        setIsConnected(true);
      }
      return;
    }

    if (!isHost && !localIsLive) return;
    if (!firestore || !user || !liveUser.isLive) return;

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;
    const isPolite = user.uid < liveUser.id;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setIsConnected(false);
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true);
      }
    };

    const signalsRef = collection(firestore, 'rooms', roomId, 'signals');

    pc.onicecandidate = (event) => {
      if (event.candidate && pc.remoteDescription) {
        addDoc(signalsRef, {
          type: 'candidate',
          from: user.uid,
          to: liveUser.id,
          candidate: event.candidate.toJSON(),
          timestamp: Date.now()
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          await addDoc(signalsRef, {
            type: 'offer',
            from: user.uid,
            to: liveUser.id,
            sdp: {
              type: pc.localDescription.type,
              sdp: pc.localDescription.sdp
            },
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current = false;
      }
    };

    const q = query(
      signalsRef, 
      where('from', '==', liveUser.id), 
      where('to', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.timestamp < mountTime.current - 2000) continue;

          try {
            if (data.type === 'offer') {
              const offerCollision = makingOffer.current || pc.signalingState !== 'stable';
              ignoreOffer.current = !isPolite && offerCollision;
              
              if (ignoreOffer.current) return;

              if (offerCollision) {
                await Promise.all([
                  pc.setLocalDescription({type: 'rollback'}),
                  pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
                ]);
              } else {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
              }

              await pc.setLocalDescription();
              if (pc.localDescription) {
                await addDoc(signalsRef, {
                  type: 'answer',
                  from: user.uid,
                  to: liveUser.id,
                  sdp: {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp
                  },
                  timestamp: Date.now()
                });
              }
            } else if (data.type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
              }
            } else if (data.type === 'candidate') {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              }
            }
          } catch (err) {
            // Silently ignore candidate errors during transient states
          }
        }
      }
    });

    return () => {
      unsubscribe();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [isLocal, localStream, firestore, user, liveUser.id, liveUser.isLive, roomId, isHost, localIsLive, isPinned]);

  return (
    <div className={cn(
        "relative bg-black rounded-lg overflow-hidden border border-white/10 group shadow-lg transition-all",
        isExpandedView ? "w-full h-full" : "aspect-video"
    )}>
      <video 
        ref={videoRef}
        autoPlay 
        muted={isLocal || isLocalMuted} 
        playsInline 
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500", 
          isLocal && "scale-x-[-1]", 
          (liveUser.isVideoOff || (!isLocal && !isConnected)) ? "opacity-0" : "opacity-100"
        )}
      />
      
      {(liveUser.isVideoOff || (!isLocal && !isConnected)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
            <Avatar className={cn(isExpandedView ? "h-32 w-32" : "h-12 w-12", "ring-2 ring-primary/50 shadow-2xl")}>
                <AvatarImage src={liveUser.avatar} />
                <AvatarFallback className="bg-primary text-white text-xl">{liveUser.name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            {!isLocal && !isConnected && (
              <div className="absolute bottom-4 text-[10px] text-white/80 animate-pulse flex items-center gap-1.5 font-medium tracking-tight">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                CONNECTING...
              </div>
            )}
        </div>
      )}

      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-10">
        <span className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white truncate max-w-[65%] font-bold shadow-sm border border-white/10">
          {liveUser.name} {isLocal && "(You)"}
        </span>
        <div className="flex gap-1 items-center bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/10">
            {isLocalMuted && <VolumeX className="h-3 w-3 text-red-500" />}
            {liveUser.isMuted && <MicOff className="h-3 w-3 text-destructive" />}
            {liveUser.isVideoOff && <VideoOff className="h-3 w-3 text-destructive" />}
        </div>
      </div>

      {!isLocal && (
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/60 hover:bg-primary/80 rounded-full text-white pointer-events-auto border border-white/20">
                          <MoreVertical className="h-4 w-4" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900/95 text-white border-white/10 shadow-2xl">
                      <DropdownMenuItem onClick={onPin} className="flex items-center gap-2 cursor-pointer focus:bg-primary/20 hover:text-primary">
                          {isPinned ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                          <span>{isPinned ? "Unpin Feed" : "Pin Feed"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onMute} className="flex items-center gap-2 cursor-pointer focus:bg-primary/20">
                          {isLocalMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-500" />}
                          <span>{isLocalMuted ? "Unmute for me" : "Mute for me"}</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          </div>
      )}
      
      {isLocal && (
        <div className="absolute top-2 left-2 pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        </div>
      )}

      {isPinned && !isExpandedView && (
          <div className="absolute top-2 left-2 pointer-events-none z-10">
              <div className="bg-primary px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest shadow-lg border border-white/20">
                PINNED
              </div>
          </div>
      )}
    </div>
  );
}
