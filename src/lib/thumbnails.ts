/**
 * The still picture shown for a video before it plays. Each is an image in src/assets/media,
 * named after the video's YouTube id.
 *
 * A video is shown as a card that plays in place only when the site has its thumbnail. A video
 * added through the editor has none until one is added here, and until then it is listed like any
 * other item, with a link: a card with no picture would break the row it sits in.
 */
import type { ImageMetadata } from 'astro';
import type { MediaItem } from './content';

const thumbs = import.meta.glob<{ default: ImageMetadata }>('../assets/media/*.jpg', {
  eager: true,
});

/** The thumbnail of the video with this YouTube id, if the site has one. */
export function thumbnail(youtubeId: string | undefined): ImageMetadata | undefined {
  return youtubeId ? thumbs[`../assets/media/${youtubeId}.jpg`]?.default : undefined;
}

/** True when an item is a video the site can show as a card and play in place. */
export const playsInPlace = (item: MediaItem): boolean =>
  thumbnail(item.data.youtubeId) !== undefined;
