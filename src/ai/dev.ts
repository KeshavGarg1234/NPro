'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/validate-youtube-url.ts';
import '@/ai/flows/get-playlist-videos.ts';
