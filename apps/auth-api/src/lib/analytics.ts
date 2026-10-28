import { isOneOf } from "@openbot/contracts/runtime-values";
import { BRAND_ROUTE } from "./brand-page";
import { COMMERCIAL_LICENSE_ROUTE } from "./commercial-license";
import { CONTENT_COLLECTIONS } from "./content";
import { type CollectionId, type ContentCollection, findArticle } from "./content-collection";
import type { DownloadPlatform } from "./download-platforms";
import { OPENBOT_DOWNLOAD_PAGE_LINKS } from "./landing-links";
import { PRIVACY_POLICY_ROUTE } from "./privacy-policy";
import { TEAMS_ROUTE } from "./teams-page";
import { TERMS_ROUTE } from "./terms";

// This fork sends no website analytics and stores no first-touch attribution.

/** How far into an article the reader got. */
export type ArticleReadDepth = "start" | "half" | "end";

/** An article the registries actually publish. Both fields are closed sets, never free text. */
export interface ArticleReference {
  collection: CollectionId;
  slug: string;
}

/** The Stripe page that closed before the desktop return page opened. */
export type BillingReturnKind = "plan" | "license" | "portal";
export const BILLING_RETURN_KINDS = ["plan", "license", "portal"] as const satisfies readonly BillingReturnKind[];

type ContactFormResult = "succeeded" | "failed" | "rate_limited";
type LandingDownloadPlatform = "linux" | "macos" | "windows" | "ios" | "android";

type CollectionIndexRoute = ContentCollection["indexRoute"];
type DownloadPagePath = (typeof OPENBOT_DOWNLOAD_PAGE_LINKS)[keyof typeof OPENBOT_DOWNLOAD_PAGE_LINKS];
/**
 * The screens a report may name. Article paths carry the slug so one article can be told from
 * another, and `safeScreenPath` keeps the set closed at runtime as well as in the type.
 */
export type LandingScreenPath =
  | "/"
  | "/join"
  | "/contact"
  | "/billing/return"
  | typeof TEAMS_ROUTE
  | typeof BRAND_ROUTE
  | typeof PRIVACY_POLICY_ROUTE
  | typeof TERMS_ROUTE
  | typeof COMMERCIAL_LICENSE_ROUTE
  | DownloadPagePath
  | CollectionIndexRoute
  | `${CollectionIndexRoute}/${string}`;

const FIXED_SCREEN_PATHS = [
  "/",
  "/join",
  "/contact",
  TEAMS_ROUTE,
  BRAND_ROUTE,
  PRIVACY_POLICY_ROUTE,
  TERMS_ROUTE,
  COMMERCIAL_LICENSE_ROUTE,
  ...Object.values(OPENBOT_DOWNLOAD_PAGE_LINKS),
  "/news",
  "/guides",
  "/compare",
  "/providers",
] as const satisfies readonly LandingScreenPath[];

/**
 * Any path that is not a fixed screen or a published article reports the landing page instead. A
 * caller cannot widen what reaches analytics by passing a different string.
 */
export function safeScreenPath(path: string): LandingScreenPath {
  if (isOneOf(FIXED_SCREEN_PATHS, path)) return path;
  const article = articleFromPath(path);
  if (!article) return "/";
  return `/${article.collection}/${article.slug}`;
}

/**
 * Resolves a site path to the article it names, or null. The slug is looked up in the registry, so
 * a link to an article that does not exist reports nothing rather than a new string.
 */
function articleFromPath(path: string): ArticleReference | null {
  const [pathname = ""] = path.split(/[?#]/u);
  for (const collection of CONTENT_COLLECTIONS) {
    const prefix = `${collection.indexRoute}/`;
    if (!pathname.startsWith(prefix)) continue;
    const slug = pathname.slice(prefix.length);
    if (findArticle(collection, slug)) return { collection: collection.id, slug };
  }
  return null;
}

class LandingAnalytics {
  start(_document: Document, _hostname: string, _screenPath = "/"): () => void {
    return () => undefined;
  }

  trackDownloadSelected(_platform: LandingDownloadPlatform, _detected: boolean): void {}

  trackArticleRead(_article: ArticleReference, _depth: ArticleReadDepth): void {}

  startJoin(
    _document: Document,
    _hostname: string,
    _options: { validInvite: boolean; platform: DownloadPlatform },
  ): () => void {
    return () => undefined;
  }

  startBillingReturn(
    _document: Document,
    _hostname: string,
    _options: { cancelled: boolean; kind: BillingReturnKind | undefined },
  ): () => void {
    return () => undefined;
  }

  trackContactFormSubmitted(_topic: string, _result: ContactFormResult): void {}
}

export const landingAnalytics = new LandingAnalytics();
