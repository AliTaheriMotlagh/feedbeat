import "server-only";
import { env } from "@/env";

/**
 * Minimal X API v2 client (app-only bearer auth).
 *
 * Only the two endpoints we need: user lookup and user timeline. The timeline
 * endpoint returns at most the 3,200 most recent posts, 100 per page.
 */

const API = "https://api.x.com/2";

export class XApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "not_found" | "protected" | "suspended" | "rate_limited" | "unavailable" | "unknown",
  ) {
    super(message);
  }
}

export interface XUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  protected?: boolean;
  public_metrics?: { followers_count: number; tweet_count: number };
}

export interface XUrlEntity {
  expanded_url?: string;
  unwound_url?: string;
  url: string;
}

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  entities?: { urls?: XUrlEntity[] };
  note_tweet?: { text: string; entities?: { urls?: XUrlEntity[] } };
  referenced_tweets?: { type: "retweeted" | "quoted" | "replied_to"; id: string }[];
}

interface Page<T> {
  data?: T;
  includes?: { tweets?: XTweet[] };
  meta?: { next_token?: string; newest_id?: string; result_count?: number };
  errors?: { title: string; detail?: string; type?: string }[];
}

async function xFetch<T>(path: string, params: Record<string, string>): Promise<Page<T>> {
  if (!env.X_BEARER_TOKEN) throw new XApiError("X API is not configured", 503, "unavailable");

  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) throw new XApiError("X rate limit reached, try again later", 429, "rate_limited");
  if (res.status === 401 || res.status === 403) {
    throw new XApiError("X API rejected our credentials", res.status, "unavailable");
  }
  if (!res.ok) throw new XApiError(`X API error ${res.status}`, res.status, "unknown");

  return (await res.json()) as Page<T>;
}

export async function getUserByUsername(username: string): Promise<XUser> {
  const page = await xFetch<XUser>(`/users/by/username/${encodeURIComponent(username)}`, {
    "user.fields": "name,description,profile_image_url,verified,protected,public_metrics",
  });
  if (!page.data) {
    const err = page.errors?.[0];
    if (err?.title?.toLowerCase().includes("suspended")) throw new XApiError("This account is suspended", 404, "suspended");
    throw new XApiError(`@${username} doesn't exist on X`, 404, "not_found");
  }
  if (page.data.protected) throw new XApiError(`@${username} has protected posts`, 403, "protected");
  return page.data;
}

export interface TimelineOptions {
  /** Only return posts newer than this id (incremental refresh). */
  sinceId?: string | null;
  /** Hard cap on posts to read (cost control). */
  maxTweets: number;
}

/** Yields timeline posts (incl. retweet/quote originals' links) newest-first. */
export async function* getUserTweets(userId: string, opts: TimelineOptions): AsyncGenerator<XTweet[]> {
  let token: string | undefined;
  let read = 0;

  do {
    const params: Record<string, string> = {
      max_results: "100",
      "tweet.fields": "created_at,entities,note_tweet,referenced_tweets",
      expansions: "referenced_tweets.id",
    };
    if (token) params.pagination_token = token;
    if (opts.sinceId) params.since_id = opts.sinceId;

    const page = await xFetch<XTweet[]>(`/users/${userId}/tweets`, params);
    const tweets = page.data ?? [];
    const included = new Map((page.includes?.tweets ?? []).map((t) => [t.id, t]));

    // Retweets carry truncated entities; merge in the original post's links.
    const merged = tweets.map((t) => {
      const refs = (t.referenced_tweets ?? []).map((r) => included.get(r.id)).filter((x): x is XTweet => !!x);
      if (!refs.length) return t;
      const urls = [...(t.entities?.urls ?? []), ...refs.flatMap((r) => r.entities?.urls ?? [])];
      return { ...t, entities: { ...t.entities, urls } };
    });

    read += tweets.length;
    if (merged.length) yield merged;
    token = page.meta?.next_token;
  } while (token && read < opts.maxTweets);
}

/** All outbound URLs referenced by a post. */
export function tweetUrls(t: XTweet): string[] {
  const entities = [...(t.entities?.urls ?? []), ...(t.note_tweet?.entities?.urls ?? [])];
  const urls = entities.map((u) => u.unwound_url ?? u.expanded_url ?? u.url).filter(Boolean);
  return [...new Set(urls)];
}
