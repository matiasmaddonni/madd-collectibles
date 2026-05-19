// Social presence config. One source of truth for handles, URLs, and
// follower-count display. Set `null` on a network we don't have yet so
// the footer + AboutMadd block hide it cleanly instead of linking a
// dead profile.

export type SocialAccount = {
  handle: string;
  url: string;
  followers: string;
};

export const INSTAGRAM: SocialAccount = {
  handle: "madd.collector",
  url: "https://instagram.com/madd.collector",
  followers: "247",
};

// Set this to a SocialAccount object when we open the TikTok profile.
// Until then, components skip rendering the TikTok icon + follower line.
export const TIKTOK: SocialAccount | null = null;
