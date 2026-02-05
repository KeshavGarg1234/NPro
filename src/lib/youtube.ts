'use server';

/**
 * @fileOverview YouTube Data API service for searching videos and fetching playlists.
 */

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

type YouTubeVideo = {
    videoId: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
};

/**
 * Searches for videos on YouTube using the Data API.
 * @param query The search term.
 * @returns A promise resolving to an array of YouTubeVideo objects.
 */
export async function searchVideos(query: string): Promise<YouTubeVideo[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
        console.error('YOUTUBE_API_KEY is missing from environment variables.');
        throw new Error('YouTube API key is not configured.');
    }

    const url = `${YOUTUBE_API_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}&maxResults=15`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
            next: { revalidate: 3600 } // Cache results for 1 hour
        });
        
        const data = await response.json();

        if (data.error) {
            console.error('YouTube API Error (Search):', data.error.message);
            throw new Error(`YouTube Search Error: ${data.error.message}`);
        }

        if (!data.items) return [];

        return data.items.map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
            channelTitle: item.snippet.channelTitle,
        }));
    } catch (error: any) {
        console.error('Failed to fetch from YouTube Search API:', error.message);
        throw error; // Let the flow handle the error
    }
}

/**
 * Fetches all embeddable videos from a YouTube playlist.
 * @param playlistId The ID of the playlist.
 * @returns A promise resolving to an array of YouTubeVideo objects.
 */
export async function getPlaylist(playlistId: string): Promise<YouTubeVideo[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        console.error('YOUTUBE_API_KEY is missing.');
        throw new Error('YouTube API key is not configured.');
    }

    let allPlaylistItems: any[] = [];
    let nextPageToken: string | undefined = undefined;

    try {
        // 1. Fetch all playlist items, handling pagination
        do {
            const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
            const playlistItemsUrl = `${YOUTUBE_API_URL}/playlistItems?part=snippet&playlistId=${playlistId}&key=${apiKey}&maxResults=50${pageTokenParam}`;
            
            const response = await fetch(playlistItemsUrl, { next: { revalidate: 3600 } });
            const data = await response.json();

            if (data.error) {
                console.error('YouTube API Error (PlaylistItems):', data.error.message);
                throw new Error(`YouTube Playlist Error: ${data.error.message}`);
            }

            if (data.items) {
                allPlaylistItems = allPlaylistItems.concat(data.items);
            }

            nextPageToken = data.nextPageToken;

        } while (nextPageToken);
        
        if (allPlaylistItems.length === 0) return [];

        const allVideoIds = allPlaylistItems
            .map((item: any) => item.snippet.resourceId.videoId)
            .filter(Boolean);

        if (allVideoIds.length === 0) return [];

        // 2. Fetch video details in batches of 50 to check embeddable status
        let allEmbeddableVideos: YouTubeVideo[] = [];
        const videoIdChunks = [];
        for (let i = 0; i < allVideoIds.length; i += 50) {
            videoIdChunks.push(allVideoIds.slice(i, i + 50));
        }

        for (const chunk of videoIdChunks) {
            const videoIdsString = chunk.join(',');
            const videosUrl = `${YOUTUBE_API_URL}/videos?part=snippet,status&id=${videoIdsString}&key=${apiKey}`;
            const videosResponse = await fetch(videosUrl);
            const videosData = await videosResponse.json();

            if (videosData.error) {
                console.error('YouTube API Error (Videos Status):', videosData.error.message);
                continue; 
            }

            if (!videosData.items) continue;

            const embeddableVideos = videosData.items
                .filter((item: any) => item.status.embeddable)
                .map((item: any) => ({
                    videoId: item.id,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
                    channelTitle: item.snippet.channelTitle,
                }));
            
            allEmbeddableVideos = allEmbeddableVideos.concat(embeddableVideos);
        }

        return allEmbeddableVideos;

    } catch (error: any) {
        console.error('Failed to process playlist:', error.message);
        throw error;
    }
}
