export type MusicTrack = {
  title: string;
  artist?: string;
  src: string;
};

// Add songs to this folder, then list them here.
// Example:
// {
//   title: "Ocean Dream",
//   artist: "Magnus",
//   src: new URL("./ocean-dream.mp3", import.meta.url).href,
// },
export const MUSIC_TRACKS: MusicTrack[] = [];
