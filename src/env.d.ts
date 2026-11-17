/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Supabase project URL for the shared Ground Truth leaderboard. Optional. */
  readonly PUBLIC_LEADERBOARD_URL?: string;
  /** That project's public (anon or publishable) key. Optional. */
  readonly PUBLIC_LEADERBOARD_KEY?: string;
}
