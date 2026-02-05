
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquareReply, X, Smile, Video, VideoOff, Lock } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, addDoc, serverTimestamp, query, orderBy, where, Timestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { EmojiBar } from './emoji-bar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '@/lib/utils';
import { CameraFeed } from './camera-feed';
import { useToast } from '@/hooks/use-toast';

const EMOJIS = ['❤️', '😂', '😢', '🤔', '👍', '🎉'];

type Message = {
  id: string;
  user: { uid: string; name: string; avatar: string };
  text: string;
  timestamp: any;
  replyingTo?: {
    messageId: string;
    userName: string;
    text: string;
  };
  reactions?: { [emoji: string]: string[] };
};

type UserData = {
  id: string;
  name: string;
  avatar: string;
  canGoLive?: boolean;
};


export function Chat({ 
    roomId, 
    userName, 
    userAvatar, 
    usersInRoom, 
    onStreamReady, 
    isLiveMode, 
    setIsLiveMode,
    isLiveDisabled,
    isHost
}: { 
    roomId: string, 
    userName: string | null, 
    userAvatar: string | null, 
    usersInRoom: UserData[] | null, 
    onStreamReady: (stream: MediaStream | null) => void, 
    isLiveMode: boolean, 
    setIsLiveMode: (val: boolean) => void,
    isLiveDisabled?: boolean,
    isHost?: boolean
}) {
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const joinTimestamp = useRef(Timestamp.now());

  const messagesRef = useMemo(() => firestore ? collection(firestore, `rooms/${roomId}/messages`) : null, [firestore, roomId]);
  
  const messagesQuery = useMemo(() => {
    if (!messagesRef) return null;
    return query(
      messagesRef, 
      where('timestamp', '>=', joinTimestamp.current),
      orderBy('timestamp', 'asc')
    );
  }, [messagesRef]);
  
  const { data: messages, loading } = useCollection<Message>(messagesQuery);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
        if (scrollHeight - scrollTop < clientHeight + 100) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
    }
  }, [messages]);

  useEffect(() => {
    if (!firestore || !user || !roomId) return;
    const userRef = doc(firestore, 'rooms', roomId, 'users', user.uid);
    updateDoc(userRef, { isLive: isLiveMode }).catch(() => {});
  }, [firestore, user, roomId, isLiveMode]);

  // Handle individual user data for live permissions
  const currentUserData = useMemo(() => usersInRoom?.find(u => u.id === user?.uid), [usersInRoom, user]);
  
  // A user can go live if they are host OR live is not disabled OR they have explicit permission
  // If reactions are ENABLED globally, we still check if the host specifically BLOCKED them (canGoLive === false)
  const canGoLive = useMemo(() => {
    if (isHost) return true;
    if (isLiveDisabled) {
        // If room is locked for reactions, only those explicitly GRANTED can join
        return !!currentUserData?.canGoLive;
    }
    // If room is open for reactions, anyone can join UNLESS explicitly BLOCKED
    return currentUserData?.canGoLive !== false;
  }, [isHost, isLiveDisabled, currentUserData?.canGoLive]);

  // Auto-disable live if permission is lost
  useEffect(() => {
    if (!canGoLive && isLiveMode) {
        setIsLiveMode(false);
        toast({
            variant: "destructive",
            title: "Live Access Removed",
            description: "The host has restricted your live reaction permissions."
        });
    }
  }, [canGoLive, isLiveMode, setIsLiveMode, toast]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || !messagesRef || !userName || !userAvatar) return;

    const messageData = {
      user: {
        uid: user.uid,
        name: userName,
        avatar: userAvatar,
      },
      text: newMessage,
      timestamp: serverTimestamp(),
      ...(replyingTo && {
        replyingTo: {
          messageId: replyingTo.id,
          userName: replyingTo.user.name,
          text: replyingTo.text,
        },
      }),
    };

    setNewMessage('');
    setReplyingTo(null);

    addDoc(messagesRef, messageData)
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: messagesRef.path,
              operation: 'create',
              requestResourceData: messageData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!firestore || !user || !messages) return;
    const messageRef = doc(firestore, `rooms/${roomId}/messages/${messageId}`);
    
    const message = messages.find(m => m.id === messageId);
    const hasReacted = message?.reactions?.[emoji]?.includes(user.uid);
    
    const updateData = {
        [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.uid) : arrayUnion(user.uid)
    };

    updateDoc(messageRef, updateData)
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: messageRef.path,
              operation: 'update',
              requestResourceData: { reaction: emoji },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };
  
  const handleReplyJump = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('bg-primary/20');
    setTimeout(() => el?.classList.remove('bg-primary/20'), 1500);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="flex h-full flex-col bg-card/60 backdrop-blur-sm border-l border-white/10">
      <div className="border-b p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Room Chat</h2>
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-block">
                        <Button 
                            variant={isLiveMode ? "default" : "outline"} 
                            size="sm" 
                            disabled={!canGoLive && !isLiveMode}
                            onClick={() => setIsLiveMode(!isLiveMode)}
                            className={cn(isLiveMode && "bg-red-600 hover:bg-red-700 animate-pulse")}
                        >
                            {!canGoLive && !isLiveMode ? <Lock className="h-4 w-4 mr-2" /> : (isLiveMode ? <VideoOff className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />)}
                            {isLiveMode ? "Stop Live" : (canGoLive ? "Go Live" : "Disabled")}
                        </Button>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>
                        {!canGoLive ? "Host has restricted live permissions" : (isLiveMode ? "Turn off camera" : "Start live reaction feed")}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>

      {isLiveMode && (
          <div className="p-4 border-b">
              <CameraFeed 
                userName={userName} 
                roomId={roomId}
                onStreamReady={onStreamReady}
              />
          </div>
      )}

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
         <div className="p-4 space-y-2" ref={viewportRef}>
          {loading && <p className="text-center text-muted-foreground">Loading chat...</p>}
          {messages && messages.length === 0 && !loading && (
            <p className="text-center text-muted-foreground">No messages yet. Say hello!</p>
          )}
          {messages && messages.map((msg) => (
            <div key={msg.id} id={`message-${msg.id}`} className="group relative flex items-start gap-3 rounded-md px-2 py-1 transition-all">
              <Avatar className='w-8 h-8'>
                <AvatarImage src={msg.user.avatar} alt={msg.user.name} />
                <AvatarFallback>{getInitials(msg.user.name)}</AvatarFallback>
              </Avatar>
              <div className='flex-1'>
                <p className="font-semibold text-sm">{msg.user.name}</p>
                 {msg.replyingTo && (
                    <a
                        onClick={() => handleReplyJump(msg.replyingTo.messageId)}
                        className="cursor-pointer block mb-1 rounded-md bg-background/30 p-2 text-xs text-muted-foreground opacity-80 hover:opacity-100"
                    >
                        <p className="font-bold">@{msg.replyingTo.userName}</p>
                        <p className="truncate">{msg.replyingTo.text}</p>
                    </a>
                 )}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words max-w-full">{msg.text}</p>
                 {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(msg.reactions).filter(([, userIds]) => userIds.length > 0).map(([emoji, userIds]) => {
                            const currentUserHasReacted = user && userIds.includes(user.uid);
                            const reactionUserNames = userIds.map(uid => usersInRoom?.find(u => u.id === uid)?.name || '...').join(', ');

                            return (
                                <TooltipProvider key={emoji} delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <button
                                                onClick={() => handleReaction(msg.id, emoji)}
                                                className={cn(
                                                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                                                    currentUserHasReacted
                                                        ? "bg-primary/20 border-primary"
                                                        : "bg-muted/50 hover:bg-muted"
                                                )}
                                            >
                                                <span>{emoji}</span>
                                                <span className='font-semibold'>{userIds.length}</span>
                                             </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className='max-w-[200px] truncate'>{reactionUserNames} reacted with {emoji}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                )}
              </div>
              <div className="absolute top-0 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-card rounded-full border border-border shadow-sm">
                <TooltipProvider delayDuration={200}>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-r-none">
                                <Smile className="h-4 w-4" />
                                <span className="sr-only">Add Reaction</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1 rounded-full bg-background/80 backdrop-blur-sm border-white/20">
                            <div className="flex items-center gap-1">
                                {EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReaction(msg.id, emoji)}
                                        className="p-2 text-xl rounded-full transition-transform transform hover:scale-125 focus:outline-none"
                                        aria-label={`React with ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-l-none"
                            onClick={() => {
                                setReplyingTo(msg);
                                inputRef.current?.focus();
                            }}
                        >
                            <MessageSquareReply className="h-4 w-4" />
                            <span className="sr-only">Reply</span>
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Reply</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ))}
         </div>
      </ScrollArea>
      {replyingTo && (
        <div className="flex items-center justify-between bg-muted/50 p-2 text-sm border-t">
            <div className="flex-1 overflow-hidden pl-2">
                <p className="font-semibold text-muted-foreground">
                    Replying to @{replyingTo.user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground/80">
                    {replyingTo.text}
                </p>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setReplyingTo(null)}
            >
                <X className="h-4 w-4" />
                <span className="sr-only">Cancel reply</span>
            </Button>
        </div>
      )}
      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={user ? (userName ? "Type a message..." : "Enter your name to chat") : "Joining room..."}
            autoComplete="off"
            disabled={!user || !userName}
          />
          <Button type="submit" size="icon" aria-label="Send Message" disabled={!user || !userName || !userAvatar || newMessage.trim() === ''}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
      <EmojiBar roomId={roomId} disabled={!user || !userName} />
    </div>
  );
}
