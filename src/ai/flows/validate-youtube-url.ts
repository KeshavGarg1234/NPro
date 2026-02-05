'use server';

/**
 * @fileOverview Genkit flow for searching YouTube videos.
 *
 * - searchYouTube - A function that searches YouTube for videos via the Data API.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { searchVideos } from '@/lib/youtube';

// == Schemas ===============================================================

const SearchYouTubeInputSchema = z.object({
    query: z.string().describe('The search query for YouTube videos.'),
});
export type SearchYouTubeInput = z.infer<typeof SearchYouTubeInputSchema>;

const YouTubeVideoSchema = z.object({
    videoId: z.string(),
    title: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    channelTitle: z.string(),
});

const SearchYouTubeOutputSchema = z.object({
  videos: z.array(YouTubeVideoSchema).describe('A list of YouTube video search results.'),
  usingFallback: z.boolean().optional().describe('True if the search failed and we are returning an empty state.')
});
export type SearchYouTubeOutput = z.infer<typeof SearchYouTubeOutputSchema>;


// == Exported Function =====================================================

/**
 * Server action to search YouTube.
 */
export async function searchYouTube(input: SearchYouTubeInput): Promise<SearchYouTubeOutput> {
    return searchYouTubeFlow(input);
}

// == Main Flow =============================================================

const searchYouTubeFlow = ai.defineFlow(
  {
    name: 'searchYouTubeFlow',
    inputSchema: SearchYouTubeInputSchema,
    outputSchema: SearchYouTubeOutputSchema,
  },
  async (input): Promise<SearchYouTubeOutput> => {
    try {
        const videos = await searchVideos(input.query);
        return { videos, usingFallback: false };
    } catch (error: any) {
        console.error('Genkit searchYouTubeFlow failed:', error.message);
        // Returning usingFallback: true triggers the toast in UrlForm.tsx
        return { videos: [], usingFallback: true };
    }
  }
);
