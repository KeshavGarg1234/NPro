'use server';

/**
 * @fileOverview Genkit flow for fetching YouTube playlist content.
 *
 * - getPlaylistVideos - Fetches video details from a YouTube playlist URL.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getPlaylist } from '@/lib/youtube';
import { extractPlaylistID } from '@/lib/utils';

const GetPlaylistVideosInputSchema = z.object({
    playlistUrl: z.string().describe('The URL of the YouTube playlist.'),
});
export type GetPlaylistVideosInput = z.infer<typeof GetPlaylistVideosInputSchema>;

const YouTubeVideoSchema = z.object({
    videoId: z.string(),
    title: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    channelTitle: z.string(),
});

const GetPlaylistVideosOutputSchema = z.object({
  videos: z.array(YouTubeVideoSchema),
  usingFallback: z.boolean().optional()
});
export type GetPlaylistVideosOutput = z.infer<typeof GetPlaylistVideosOutputSchema>;

/**
 * Server action to fetch playlist videos.
 */
export async function getPlaylistVideos(input: GetPlaylistVideosInput): Promise<GetPlaylistVideosOutput> {
    return getPlaylistVideosFlow(input);
}

const getPlaylistVideosFlow = ai.defineFlow(
  {
    name: 'getPlaylistVideosFlow',
    inputSchema: GetPlaylistVideosInputSchema,
    outputSchema: GetPlaylistVideosOutputSchema,
  },
  async (input): Promise<GetPlaylistVideosOutput> => {
    try {
      const playlistId = extractPlaylistID(input.playlistUrl);
      if (!playlistId) {
        return { videos: [], usingFallback: true };
      }

      const videos = await getPlaylist(playlistId);
      return { videos, usingFallback: false };

    } catch (error: any) {
      console.error('Genkit getPlaylistVideosFlow failed:', error.message);
      return { videos: [], usingFallback: true };
    }
  }
);
