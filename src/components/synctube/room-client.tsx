'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Share2,
  Users,
  Loader2,
  PanelLeft,
  PanelRight,
  GripVertical,
  Play,
  Pause,
  Trash2,
  SkipBack,
  SkipForward,
  ChevronDown,
  RefreshCcw,
  Repeat,
  Repeat1,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Video,
  VideoOff,
  Settings,
  MoreVertical,
  UserCheck,
  UserX,
  Youtube,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Chat } from './chat';
import { YouTubePlayer } from './youtube-player';
import { UrlForm, type SearchResultVideo } from './url-form';
import { NameEntryOverlay } from './name-entry-overlay';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { EmojiFlyout } from './emoji-flyout';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LiveParticipants } from './live-participants';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import {
  doc,
  updateDoc,
  collection,
  deleteDoc,
  serverTimestamp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

type QueuedVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

type RoomData = {
  id?: string;
  roomId: string;
  hostId: string;
  videoId: string;
  isPlaying: boolean;
  timestamp: number;
  userCount: number;
  isLocked?: boolean;
  isLiveDisabled?: boolean;
  createdAt: any;
  queue: QueuedVideo[];
  currentQueueIndex: number;
  repeat: boolean;
};

type UserData = {
  id: string;
  name: string;
  avatar: string;
  isLive?: boolean;
  canGoLive?: boolean;
};

export default function RoomClient({ roomId }: { roomId:string }) {
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showNameEntry, setShowNameEntry] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [localMutedUsers, setLocalMutedUsers] = useState<string[]>([]);
  
  const roomRef = useMemo(() => firestore ? doc(firestore, 'rooms', roomId) : null, [firestore, roomId]);
  const usersRef = useMemo(() => roomRef ? collection(roomRef, 'users') : null, [roomRef]);
  const userRef = useMemo(() => (firestore && user) ? doc(usersRef!, user.uid) : null, [firestore, user, usersRef]);
  
  const { data: roomData, loading: roomLoading } = useDoc<RoomData>(roomRef);
  const { data: usersInRoom } = useCollection<UserData>(usersRef);
  const { data: currentUserDoc, loading: currentUserLoading } = useDoc<UserData>(userRef);
  
  const [localQueue, setLocalQueue] = useState<QueuedVideo[]>([]);
  useEffect(() => {
    if (roomData?.queue) {
      setLocalQueue(roomData.queue);
    }
  }, [roomData?.queue]);

  const playerRef = useRef<any>(null);
  const isHost = user?.uid === roomData?.hostId;
  const hasJoined = useRef(false);
  const isLeaving = useRef(false);
  
  const currentVideo = useMemo(() => {
    if (!roomData || !roomData.queue || roomData.currentQueueIndex < 0 || roomData.currentQueueIndex >= (roomData.queue?.length ?? 0)) {
      return null;
    }
    return roomData.queue[roomData.currentQueueIndex];
  }, [roomData]);

  const currentVideoId = currentVideo?.videoId || roomData?.videoId;

  const handleNameSubmit = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.abs(hash).toString(16).padStart(6, '0').substring(0, 6);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=128&bold=true`;
    
    setUserName(name);
    setUserAvatar(avatarUrl);
    setShowNameEntry(false);
  };
  
  useEffect(() => {
    const storedName = localStorage.getItem(`synctube-name-${roomId}`);
    if (storedName) {
      handleNameSubmit(storedName);
    }
  }, [roomId]);
  
  useEffect(() => {
    if (userName) {
      localStorage.setItem(`synctube-name-${roomId}`, userName);
    }
  }, [userName, roomId]);

  useEffect(() => {
    if (hasJoined.current && !roomLoading && !currentUserLoading && !isLeaving.current) {
        if (!currentUserDoc && roomData) {
            toast({
                variant: "destructive",
                title: "Removed from room",
                description: "You have been removed by the host."
            });
            router.push('/');
        }
    }
  }, [currentUserDoc, roomData, roomLoading, currentUserLoading, router, toast]);
  
  useEffect(() => {
    if (userLoading || !firestore || !user || !userRef || !roomRef || !usersRef || !userName || !userAvatar) {
        return;
    }
    
    if (hasJoined.current) {
        return;
    }

    const joinAndSetupPresence = async () => {
        try {
            await runTransaction(firestore, async (transaction) => {
                const roomSnapshot = await transaction.get(roomRef);
                if (!roomSnapshot.exists()) {
                    setIsRedirecting(true);
                    return;
                }
                
                const data = roomSnapshot.data() as RoomData;
                const existingUserSnapshot = await transaction.get(userRef);
                
                // Block if room is locked AND we are a new participant AND not the host
                if (data.isLocked && !existingUserSnapshot.exists() && user.uid !== data.hostId) {
                    setIsRedirecting(true);
                    return;
                }

                transaction.set(userRef, { 
                    name: userName, 
                    avatar: userAvatar,
                    isLive: false,
                    isMuted: false,
                    isVideoOff: false,
                    canGoLive: !data.isLiveDisabled 
                }, { merge: true });

                if (!existingUserSnapshot.exists()) {
                    transaction.update(roomRef, { userCount: increment(1) });
                }
            });
            hasJoined.current = true;
        } catch (err: any) {
            console.error("Failed to join room:", err);
            setIsRedirecting(true);
        }
    };

    joinAndSetupPresence();

    const leaveRoom = () => {
        if (!firestore || !roomRef || !userRef || isLeaving.current) return;
        isLeaving.current = true;
        
        runTransaction(firestore, async (transaction) => {
            const userSnapshot = await transaction.get(userRef);
            if (userSnapshot.exists()) {
                transaction.delete(userRef);
                transaction.update(roomRef, { userCount: increment(-1) });
            }
        }).catch(err => {
            console.error("Failed to leave room cleanly:", err);
            deleteDoc(userRef).catch(() => {});
        });
    };

    window.addEventListener('beforeunload', leaveRoom);

    return () => {
        window.removeEventListener('beforeunload', leaveRoom);
        leaveRoom();
        hasJoined.current = false;
    };
  }, [firestore, user, userLoading, userRef, usersRef, roomRef, userName, userAvatar, router, toast]);

  useEffect(() => {
    if (isRedirecting) {
        toast({ variant: "destructive", title: "Cannot Join", description: "Room is locked or no longer exists." });
        router.push('/');
    }
  }, [isRedirecting, router, toast]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!roomLoading && !roomData && !userLoading && hasJoined.current) {
        toast({ variant: "destructive", title: "Room closed", description: "This room is no longer available." });
        timer = setTimeout(() => { router.push('/'); }, 2000);
    }
    return () => clearTimeout(timer);
  }, [roomLoading, roomData, userLoading, router, toast]);

  const copyRoomLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link Copied!', description: 'Share this link with your friends.' });
  }, [toast]);

  const handleToggleRoomLock = useCallback(() => {
    if (!isHost || !roomRef || !roomData) return;
    updateDoc(roomRef, { isLocked: !roomData.isLocked });
    toast({ 
        title: roomData.isLocked ? "Room Unlocked" : "Room Locked", 
        description: roomData.isLocked ? "New users can now join." : "No new users can join." 
    });
  }, [isHost, roomRef, roomData, toast]);

  const handleToggleLiveDisabled = useCallback(() => {
    if (!isHost || !roomRef || !roomData) return;
    const newState = !roomData.isLiveDisabled;
    updateDoc(roomRef, { isLiveDisabled: newState });
    toast({ 
        title: newState ? "Reactions Disabled" : "Reactions Enabled", 
        description: newState ? "Only permitted users can go live." : "Everyone can now go live." 
    });
  }, [isHost, roomRef, roomData, toast]);

  const handleToggleUserLiveAccess = useCallback((targetUserId: string, currentAccess: boolean) => {
    if (!isHost || !firestore || !roomId) return;
    const targetUserRef = doc(firestore, 'rooms', roomId, 'users', targetUserId);
    updateDoc(targetUserRef, { canGoLive: !currentAccess });
  }, [isHost, firestore, roomId]);

  const handleKickUser = useCallback(async (targetUserId: string) => {
    if (!isHost || !firestore || !roomId || !roomRef) return;
    const targetUserRef = doc(firestore, 'rooms', roomId, 'users', targetUserId);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const userSnapshot = await transaction.get(targetUserRef);
            if (userSnapshot.exists()) {
                transaction.delete(targetUserRef);
                transaction.update(roomRef, { userCount: increment(-1) });
            }
        });
        toast({ title: "User kicked", description: "The user has been removed from the room." });
    } catch (err) {
        console.error("Kick failed:", err);
    }
  }, [isHost, firestore, roomId, roomRef, toast]);

  const handleSyncToHost = useCallback(() => {
    if (isHost || !playerRef.current || !roomData) return;
    playerRef.current.seekTo(roomData.timestamp, true);
    toast({ title: 'Synced!', description: "Caught up with the host." });
  }, [isHost, roomData, toast]);

  const handleVideoIdChange = useCallback((id: string) => {
    if (!roomRef) return;
    updateDoc(roomRef, { videoId: id, isPlaying: true, timestamp: 0, currentQueueIndex: -1 });
  }, [roomRef]);

  const handleAddToQueue = useCallback((video: SearchResultVideo) => {
    if (!roomRef || !roomData) return;
    const newQueue = [...(roomData.queue || []), {
      videoId: video.videoId,
      title: video.title,
      thumbnail: video.thumbnail,
      channelTitle: video.channelTitle,
    }];
    updateDoc(roomRef, { queue: newQueue, currentQueueIndex: (roomData.currentQueueIndex === -1 ? 0 : roomData.currentQueueIndex) });
  }, [roomRef, roomData]);

  const handleAddAllToQueue = useCallback((videos: SearchResultVideo[]) => {
    if (!roomRef || !roomData) return;
    const newQueue = [...(roomData.queue || []), ...videos.map(v => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
      channelTitle: v.channelTitle,
    }))];
    updateDoc(roomRef, { queue: newQueue, currentQueueIndex: (roomData.currentQueueIndex === -1 ? 0 : roomData.currentQueueIndex) });
  }, [roomRef, roomData]);

  const handlePlayAll = useCallback((videos: SearchResultVideo[]) => {
    if (!roomRef) return;
    updateDoc(roomRef, { 
        queue: videos.map(v => ({ videoId: v.videoId, title: v.title, thumbnail: v.thumbnail, channelTitle: v.channelTitle })),
        currentQueueIndex: 0, 
        isPlaying: true, 
        timestamp: 0 
    });
  }, [roomRef]);
  
  const handlePlayNext = useCallback(() => {
    if (!isHost || !roomData || !roomData.queue || !roomRef) return;
    if (roomData.currentQueueIndex < roomData.queue.length - 1) {
        updateDoc(roomRef, { currentQueueIndex: roomData.currentQueueIndex + 1, timestamp: 0, isPlaying: true });
    }
  }, [isHost, roomData, roomRef]);

  const handlePlayPrev = useCallback(() => {
    if (!isHost || !roomData || !roomData.queue || !roomRef) return;
    if (roomData.currentQueueIndex > 0) {
        updateDoc(roomRef, { currentQueueIndex: roomData.currentQueueIndex - 1, timestamp: 0, isPlaying: true });
    }
  }, [isHost, roomData, roomRef]);

  const handleReorderQueue = useCallback((reorderedQueue: QueuedVideo[]) => {
    if (!roomRef || !isHost || !roomData) return;
    const currentPlayingVideo = roomData.queue[roomData.currentQueueIndex];
    const newIndex = reorderedQueue.findIndex(v => v.videoId === currentPlayingVideo?.videoId);
    updateDoc(roomRef, { queue: reorderedQueue, currentQueueIndex: newIndex === -1 ? 0 : newIndex });
  }, [roomRef, isHost, roomData]);

  const handleRemoveFromQueue = useCallback((indexToRemove: number) => {
    if (!roomRef || !isHost || !roomData?.queue) return;
    const newQueue = [...roomData.queue];
    newQueue.splice(indexToRemove, 1);
    let newIndex = roomData.currentQueueIndex;
    if (indexToRemove < newIndex) newIndex--;
    else if (indexToRemove === newIndex) {
        if (newIndex >= newQueue.length) newIndex = roomData.repeat && newQueue.length > 0 ? 0 : -1;
    }
    updateDoc(roomRef, { queue: newQueue, currentQueueIndex: newIndex });
  }, [roomRef, isHost, roomData]);

  const handlePlayFromQueue = useCallback((indexToPlay: number) => {
    if (!roomRef || !isHost) return;
    updateDoc(roomRef, { currentQueueIndex: indexToPlay, timestamp: 0, isPlaying: true });
  }, [roomRef, isHost]);
  
  const handleClearQueue = useCallback(() => {
    if (!isHost || !roomRef) return;
    updateDoc(roomRef, { queue: [], currentQueueIndex: -1, isPlaying: false, timestamp: 0 });
  }, [isHost, roomRef]);

  const handleToggleRepeat = useCallback(() => {
    if (!isHost || !roomRef || !roomData) return;
    updateDoc(roomRef, { repeat: !roomData.repeat });
  }, [isHost, roomRef, roomData]);

  const handlePlayerStateChange = useCallback((event: any) => {
    if (!isHost || !roomData || !roomRef || !playerRef.current) return;
    const playerState = event.data;
    if (playerState === 0) { 
        if (roomData.currentQueueIndex >= (roomData.queue?.length ?? 0) - 1 && roomData.repeat) {
            updateDoc(roomRef, { currentQueueIndex: 0, timestamp: 0, isPlaying: true });
        } else {
            handlePlayNext();
        }
        return; 
    }
    let updateData: Partial<RoomData> = {};
    if ((playerState === 1 || playerState === 3) && !roomData.isPlaying) updateData.isPlaying = true;
    else if (playerState === 2 && roomData.isPlaying) updateData.isPlaying = false;
    if (Object.keys(updateData).length > 0) {
      updateData.timestamp = playerRef.current.getCurrentTime();
      updateDoc(roomRef, updateData);
    }
  }, [isHost, roomData, roomRef, handlePlayNext]);

  const handleTogglePlay = useCallback(() => {
    if (!isHost || !roomRef || !roomData || !playerRef.current) return;
    const currentTime = playerRef.current.getCurrentTime();
    updateDoc(roomRef, { isPlaying: !roomData.isPlaying, timestamp: currentTime });
  }, [isHost, roomRef, roomData]);

  useEffect(() => {
    if (!isHost || !roomData?.isPlaying || !roomRef || !isPlayerReady) return;
    const interval = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
            updateDoc(roomRef, { timestamp: playerRef.current.getCurrentTime() }).catch(() => {});
        }
    }, 4000); 
    return () => clearInterval(interval);
  }, [isHost, roomData?.isPlaying, roomRef, isPlayerReady]);

  const onPlayerReady = useCallback(() => { setIsPlayerReady(true); }, []);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalQueue((items) => {
        const oldIndex = items.findIndex(item => item.videoId === active.id);
        const newIndex = items.findIndex(item => item.videoId === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        handleReorderQueue(reordered);
        return reordered;
      });
    }
  }

  const togglePinUser = useCallback((uid: string) => setPinnedUserId(p => p === uid ? null : uid), []);
  const toggleLocalMuteUser = useCallback((uid: string) => setLocalMutedUsers(p => p.includes(uid) ? p.filter(i => i !== uid) : [...p, uid]), []);

  if (userLoading || roomLoading || !roomData || isRedirecting) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p>{isRedirecting ? "Redirecting..." : "Initializing Room..."}</p>
      </div>
    );
  }
  
  if (showNameEntry) return <NameEntryOverlay onNameSubmit={handleNameSubmit} />;
  const pinnedUser = usersInRoom?.find(u => u.id === pinnedUserId);

  return (
    <div className="relative h-dvh w-dvh">
        <EmojiFlyout roomId={roomId} />
        <div className="flex flex-col md:flex-row h-full max-h-full overflow-hidden">
            <main className={cn("flex-1 flex flex-col p-4 md:p-6 space-y-4 overflow-y-auto", isChatMinimized && "md:px-24")}>
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                          <Youtube className="h-6 w-6 text-primary" />
                          <h1 className="text-2xl font-bold tracking-tight">SyncTube</h1>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground border-l pl-4 border-white/10">
                          <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                              <span>{roomData.userCount} online</span>
                          </div>
                          <span className="hidden sm:inline">Room: {roomId}</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={copyRoomLink}><Share2 className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Share</p></TooltipContent></Tooltip>
                      
                      {isHost && (
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button></DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Settings</p></TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-64 bg-background/95 backdrop-blur-md">
                            <DropdownMenuLabel>Room Security</DropdownMenuLabel>
                            <DropdownMenuItem onClick={handleToggleRoomLock} className="flex items-center justify-between cursor-pointer">
                              <div className="flex items-center gap-2">
                                {roomData.isLocked ? <Lock className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4" />}
                                <span>{roomData.isLocked ? "Unlock Room" : "Lock Room"}</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleToggleLiveDisabled} className="flex items-center justify-between cursor-pointer">
                              <div className="flex items-center gap-2">
                                {roomData.isLiveDisabled ? <VideoOff className="h-4 w-4 text-red-500" /> : <Video className="h-4 w-4" />}
                                <span>{roomData.isLiveDisabled ? "Enable Reactions" : "Disable Reactions"}</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            
                            <Dialog>
                                <DialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2 cursor-pointer">
                                        <UserCheck className="h-4 w-4" />
                                        <span>Manage Participants</span>
                                    </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent className="max-w-md bg-background/95 backdrop-blur-sm border-white/10">
                                    <DialogHeader>
                                        <DialogTitle>Manage Participants</DialogTitle>
                                        <DialogDescription>Grant live permissions or remove users from the room.</DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-80 pr-4 mt-4">
                                        <div className="space-y-4">
                                            {usersInRoom?.filter(u => u.id !== user?.uid).map(u => (
                                                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8"><AvatarImage src={u.avatar} /><AvatarFallback>{u.name[0]}</AvatarFallback></Avatar>
                                                        <span className="text-sm font-medium">{u.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-2 mr-2">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Live</Label>
                                                            <Switch 
                                                              checked={u.canGoLive || false} 
                                                              onCheckedChange={() => handleToggleUserLiveAccess(u.id, u.canGoLive || false)} 
                                                            />
                                                        </div>
                                                        <Button 
                                                          variant="ghost" 
                                                          size="icon" 
                                                          className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                                          onClick={() => handleKickUser(u.id)}
                                                        >
                                                            <UserX className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {usersInRoom?.filter(u => u.id !== user?.uid).length === 0 && (
                                              <p className="text-center text-sm text-muted-foreground py-4">No other participants in the room.</p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {!isHost && (
                        <Tooltip>
                            <TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleSyncToHost}><RefreshCcw className="h-5 w-5" /></Button></TooltipTrigger>
                            <TooltipContent><p>Sync to Host</p></TooltipContent>
                        </Tooltip>
                      )}
                      
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsChatMinimized(m => !m)} className="hidden md:inline-flex">{isChatMinimized ? <PanelLeft/> : <PanelRight/>}</Button></TooltipTrigger><TooltipContent><p>{isChatMinimized ? 'Show Chat' : 'Hide Chat'}</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                  </div>
                </header>

                <LiveParticipants 
                    roomId={roomId} 
                    localStream={localStream} 
                    isHost={isHost} 
                    isLocalLive={isLiveMode} 
                    pinnedUserId={pinnedUserId}
                    localMutedUsers={localMutedUsers}
                    onPinUser={togglePinUser}
                    onMuteUser={toggleLocalMuteUser}
                    isLiveDisabled={roomData.isLiveDisabled}
                    excludeUserId={pinnedUserId}
                />

                <Collapsible asChild defaultOpen>
                    <Card className="bg-card/60 backdrop-blur-sm border-white/20">
                        <CardContent className="p-4 flex flex-col gap-4">
                            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group">
                                <YouTubePlayer 
                                    videoId={currentVideoId} 
                                    onStateChange={handlePlayerStateChange} 
                                    playerRef={playerRef} 
                                    onReady={onPlayerReady} 
                                    isPlaying={!!roomData.isPlaying}
                                    timestamp={roomData.timestamp}
                                    isHost={isHost}
                                />
                                {pinnedUserId && (
                                    <div className="absolute inset-0 z-20 bg-black/95">
                                        <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                            <Maximize2 className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-bold">{pinnedUser?.name || 'User Feed'}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 hover:bg-white/20" onClick={() => setPinnedUserId(null)}><Minimize2 className="h-4 w-4" /></Button>
                                        </div>
                                        <LiveParticipants 
                                            roomId={roomId} localStream={localStream} isHost={isHost} isLocalLive={isLiveMode} 
                                            pinnedUserId={pinnedUserId} localMutedUsers={localMutedUsers} onPinUser={togglePinUser} onMuteUser={toggleLocalMuteUser} 
                                            isExpandedView={true} isLiveDisabled={roomData.isLiveDisabled}
                                        />
                                    </div>
                                )}
                            </div>

                            {(roomData.queue?.length ?? 0) > 0 && (
                                <div className='flex items-center justify-between bg-muted/30 p-2 rounded-lg'>
                                    <div className='flex-1 overflow-hidden'><p className='text-xs text-muted-foreground'>Now Playing</p><p className='font-semibold truncate'>{currentVideo?.title ?? '...'}</p></div>
                                    <div className='flex items-center gap-1'>
                                        <TooltipProvider>
                                            {isHost && (<><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handlePlayPrev} disabled={roomData.currentQueueIndex <= 0}><SkipBack /></Button></TooltipTrigger><TooltipContent><p>Previous</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleTogglePlay} disabled={!isPlayerReady}>{roomData.isPlaying ? <Pause /> : <Play />}</Button></TooltipTrigger><TooltipContent><p>{roomData.isPlaying ? 'Pause' : 'Play'}</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handlePlayNext} disabled={roomData.currentQueueIndex >= (roomData.queue?.length ?? 0) - 1}><SkipForward /></Button></TooltipTrigger><TooltipContent><p>Next</p></TooltipContent></Tooltip></>)}
                                            <Tooltip><CollapsibleTrigger asChild><Button variant="ghost" size="icon"><ChevronDown className="h-5 w-5" /></Button></CollapsibleTrigger><TooltipContent><p>Toggle Queue</p></TooltipContent></Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CollapsibleContent>
                             {(roomData?.queue?.length ?? 0) > 0 && (
                                <div className="p-4 pt-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-semibold">Queue ({roomData.queue?.length || 0})</h3>
                                        {isHost && (<div className="flex items-center gap-1"><TooltipProvider>
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleClearQueue}><Trash2 className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Clear</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleToggleRepeat}>{roomData.repeat ? <Repeat1 className="h-5 w-5 text-primary" /> : <Repeat className="h-5 w-5" />}</Button></TooltipTrigger><TooltipContent><p>Repeat</p></TooltipContent></Tooltip>
                                        </TooltipProvider></div>)}
                                    </div>
                                    <ScrollArea className="h-64"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext items={localQueue.map(v => v.videoId)} strategy={verticalListSortingStrategy}><div className="space-y-2">{localQueue.map((video, index) => (
                                            <SortableQueueItem key={video.videoId} video={video} index={index} isHost={isHost} isPlaying={index === roomData.currentQueueIndex} onRemove={handleRemoveFromQueue} onPlay={handlePlayFromQueue} />
                                        ))}</div></SortableContext>
                                    </DndContext></ScrollArea>
                                </div>
                            )}
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
                
                {isHost && (
                  <Card className="bg-card/60 backdrop-blur-sm border-white/20">
                      <CardHeader className="pb-2"><CardTitle className="text-lg">Host Controls</CardTitle></CardHeader>
                      <CardContent><UrlForm onVideoIdChange={handleVideoIdChange} onAddToQueue={handleAddToQueue} onPlayAll={handlePlayAll} onAddAllToQueue={handleAddAllToQueue} /></CardContent>
                  </Card>
                )}
            </main>

            <aside className={cn("md:max-h-dvh h-1/2 md:h-full transition-all duration-300", isChatMinimized ? "w-full md:w-0" : "w-full md:w-96")}>
                <div className={cn("h-full w-full", isChatMinimized && "hidden")}>
                    <Chat 
                      roomId={roomId} 
                      userName={userName} 
                      userAvatar={userAvatar} 
                      usersInRoom={usersInRoom} 
                      onStreamReady={setLocalStream} 
                      isLiveMode={isLiveMode} 
                      setIsLiveMode={setIsLiveMode} 
                      isLiveDisabled={roomData.isLiveDisabled} 
                      isHost={isHost} 
                    />
                </div>
            </aside>
        </div>
    </div>
  );
}

function SortableQueueItem({ video, index, isHost, isPlaying, onRemove, onPlay }: { video: QueuedVideo, index: number, isHost: boolean, isPlaying: boolean, onRemove: (index: number) => void, onPlay: (index: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: video.videoId });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-3 p-2 rounded-md transition-colors", isPlaying ? "bg-primary/20" : "bg-muted/30 hover:bg-muted/50", isHost && "cursor-pointer")} onClick={() => isHost && onPlay(index)}>
        {isHost && (<div {...attributes} {...listeners} className="cursor-grab p-2 text-muted-foreground"><GripVertical className="h-5 w-5" /></div>)}
        <div className="relative group/queueitem w-20 h-11 rounded-md overflow-hidden shrink-0 bg-muted">
            <Image src={video.thumbnail} alt={video.title} fill style={{ objectFit: 'cover' }} />
            {isHost && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/queueitem:opacity-100 transition-opacity z-10" onClick={(e) => { e.stopPropagation(); onRemove(index); }}>
                <Trash2 className="text-white h-6 w-6" />
            </div>)}
        </div>
        <div className='flex-1 overflow-hidden'><p className="font-semibold text-sm truncate">{video.title}</p><p className="text-xs text-muted-foreground truncate">{video.channelTitle}</p></div>
    </div>
  );
}
