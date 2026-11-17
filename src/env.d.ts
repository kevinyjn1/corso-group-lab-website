/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Address of the Google Sheet web app that keeps the shared Ground Truth leaderboard.
   * Optional: without it each device keeps its own board.
   */
  readonly PUBLIC_LEADERBOARD_URL?: string;
}
