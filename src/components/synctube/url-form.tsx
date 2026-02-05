'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2, Search, Link as LinkIcon, ListVideo, PlusSquare, Play, ListPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import { extractYouTubeID, extractPlaylistID } from '@/lib/utils';
import { searchYouTube } from '@/ai/flows/validate-youtube-url';
import { getPlaylistVideos } from '@/ai/flows/get-playlist-videos';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export type SearchResultVideo = {
    videoId: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
};

type UrlFormProps = {
  onVideoIdChange: (videoId: string) => void;
  onAddToQueue: (video: SearchResultVideo) => void;
  onPlayAll: (videos: SearchResultVideo[]) => void;
  onAddAllToQueue: (videos: SearchResultVideo[]) => void;
};

export function UrlForm({ onVideoIdChange, onAddToQueue, onPlayAll, onAddAllToQueue }: UrlFormProps) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<SearchResultVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUrlTransition, startUrlTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("search");
  const { toast } = useToast();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setInputValue('');
    setResults([]);
    setIsLoading(false);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startUrlTransition(async () => {
      const videoId = extractYouTubeID(inputValue);
      if (!videoId) {
        toast({
          variant: 'destructive',
          title: 'Invalid URL',
          description: 'Could not extract a valid YouTube video ID from the URL.',
        });
        return;
      }
      onVideoIdChange(videoId);
      setInputValue('');
    });
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim() === '') return;
      setIsLoading(true);
      setResults([]);
      try {
        const response = await searchYouTube({ query: inputValue });
        setResults(response.videos);
        if (response.usingFallback) {
          toast({
            variant: 'destructive',
            title: 'Search Failed',
            description: 'The YouTube API search failed. Please check your API key configuration.',
          });
        } else if (response.videos.length === 0) {
            toast({
                variant: 'default',
                title: 'No results found',
                description: `Your search for "${inputValue}" did not return any results.`,
            });
        }
      } catch (error) {
        console.error("Search failed:", error);
        toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: 'Could not fetch YouTube search results.',
        })
      } finally {
        setIsLoading(false);
      }
  };

  const handlePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const playlistId = extractPlaylistID(inputValue);
    if (!playlistId) {
        toast({
            variant: 'destructive',
            title: 'Invalid Playlist URL',
            description: 'Could not extract a valid YouTube playlist ID from the URL.',
        });
        return;
    }
    setIsLoading(true);
    setResults([]);
    try {
        const response = await getPlaylistVideos({ playlistUrl: inputValue });
        if (response.usingFallback) {
          toast({
              variant: 'destructive',
              title: 'Playlist Fetch Failed',
              description: 'Could not process the playlist. Check the URL and your API key.',
          });
        } else if (response.videos.length === 0) {
            toast({
                variant: 'default',
                title: 'No videos found',
                description: 'Could not find any embeddable videos in that playlist.',
            });
        } else {
            setResults(response.videos);
        }
    } catch (error) {
        console.error("Playlist fetch failed due to server action crash:", error);
        toast({
          variant: 'destructive',
          title: 'Server Error',
          description: 'An unexpected error occurred while fetching the playlist.',
        })
    } finally {
        setIsLoading(false);
    }
  };

  const renderResults = () => (
    <>
      {isLoading && (
        <div className="mt-4 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
        </div>
      )}
      {results.length > 0 && (
        <>
          {activeTab === 'playlist' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => onPlayAll(results)} disabled={isLoading}>
                <Play className="mr-2 h-4 w-4" /> Play All
              </Button>
              <Button variant="secondary" onClick={() => onAddAllToQueue(results)} disabled={isLoading}>
                <ListPlus className="mr-2 h-4 w-4" /> Add All to Queue
              </Button>
            </div>
          )}
          <TooltipProvider>
            <ScrollArea className="h-64 mt-4">
                <div className="space-y-2 pr-4">
                    {results.map((video, index) => (
                        <Card key={`${video.videoId}-${index}`} className="group overflow-hidden hover:bg-muted/50 transition-colors">
                            <div className="p-2 flex items-center gap-3">
                                <div 
                                    className="relative w-28 h-16 rounded-md overflow-hidden shrink-0 bg-muted cursor-pointer group/thumb"
                                >
                                    <Image src={video.thumbnail} alt={video.title} fill style={{ objectFit: 'cover' }} onClick={() => onVideoIdChange(video.videoId)} />
                                    <div 
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddToQueue(video);
                                        }}
                                    >
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button className="h-full w-full flex items-center justify-center" aria-label="Add to Queue">
                                                    <PlusSquare className="text-white h-8 w-8" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Add to Queue</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                                <div 
                                    className='flex-1 overflow-hidden min-w-0 cursor-pointer'
                                    onClick={() => onVideoIdChange(video.videoId)}
                                >
                                    <p className="font-semibold text-sm truncate">{video.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{video.channelTitle}</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
          </TooltipProvider>
        </>
      )}
    </>
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search"><Search className="mr-2 h-4 w-4" /> Search</TabsTrigger>
            <TabsTrigger value="playlist"><ListVideo className="mr-2 h-4 w-4" /> Playlist</TabsTrigger>
            <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" /> URL</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
            <form onSubmit={handleSearchSubmit} className="flex w-full items-center space-x-2">
                <Input
                    id="search"
                    name="search"
                    type="text"
                    placeholder="Search for a video..."
                    required
                    className="text-base"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={isLoading || !inputValue} aria-label="Search YouTube">
                    {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
            </form>
            {renderResults()}
        </TabsContent>

        <TabsContent value="playlist" className="mt-4">
            <form onSubmit={handlePlaylistSubmit} className="flex w-full items-center space-x-2">
                <Input
                    id="playlist"
                    name="playlist"
                    type="url"
                    placeholder="Enter a YouTube playlist URL..."
                    required
                    className="text-base"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={isLoading || !inputValue} aria-label="Fetch Playlist Videos">
                    {isLoading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                </Button>
            </form>
            {renderResults()}
        </TabsContent>

        <TabsContent value="url" className="mt-4">
            <form onSubmit={handleUrlSubmit} className="flex w-full items-center space-x-2">
            <Input
                id="url"
                name="url"
                type="url"
                placeholder="Enter a single YouTube URL..."
                required
                className="text-base"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isUrlTransition}
            />
            <Button type="submit" size="icon" disabled={isUrlTransition || !inputValue} aria-label="Set Video">
                {isUrlTransition ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            </Button>
            </form>
        </TabsContent>
    </Tabs>
  );
}
