import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractYouTubeID(url: string): string | null {
  // Regular expression to find YouTube video ID in various URL formats
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)

  return match && match[2].length === 11 ? match[2] : null
}

export function extractPlaylistID(url: string): string | null {
  const regExp = /[?&]list=([^#&?]+)/;
  const match = url.match(regExp);

  return match && match[1] ? match[1] : null;
}

export function generateRoomId() {
  // Generate a 9-digit room code
  return Math.floor(100_000_000 + Math.random() * 900_000_000).toString();
}
