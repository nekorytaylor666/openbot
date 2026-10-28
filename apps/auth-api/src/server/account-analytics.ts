import type { BillingCurrency, BillingInterval, BillingPlanId } from "@openbot/contracts/billing";
import { FIRST_TOUCH_CAMPAIGN_FIELDS, type FirstTouch, parseFirstTouch } from "@openbot/contracts/first-touch";
import type { HostedServerEntryPoint, HostedServerError, HostedServerSize } from "@openbot/contracts/hosted-servers";
import type { Effect } from "effect";

const BILLING_ACTIONS = [
  "checkout_started",
  "checkout_expired",
  "plan_started",
  "payment_succeeded",
  "payment_failed",
  "plan_changed",
  "cancel_scheduled",
  "cancel_withdrawn",
  "plan_ended",
  "portal_opened",
] as const;
export type BillingAction = (typeof BILLING_ACTIONS)[number];

const HOSTED_SERVER_ACTIONS = [
  "provisioned",
  "setup_failed",
  "idle_stopped",
  "woken",
  "resized",
  "plan_stopped",
  "renewed",
  "deleted",
] as const;
type HostedServerAction = (typeof HOSTED_SERVER_ACTIONS)[number];

const PORTAL_FLOWS = ["manage", "update", "cancel"] as const;
/** What a billing event is for: a hosted server plan or the commercial license. */
export type BillingProduct = "server" | "license";
/** On `plan_changed`: the new plan or user count costs more (`up`) or less (`down`). */
export type PlanChangeDirection = "up" | "down";
/**
 * The largest license user count that analytics accepts. The app sells up to 25 users; a license
 * from the Stripe Dashboard can have more, so the bound only stops a value that is not a count.
 */
const ANALYTICS_MAX_LICENSE_USERS = 10_000;

/** True for a license user count that analytics can send. */
export function isAnalyticsLicenseUsers(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= ANALYTICS_MAX_LICENSE_USERS;
}
const WAKE_REASONS = ["message", "restart", "schedule", "retention"] as const;
/** Why a plan ended: the account cancelled it, or Stripe ended it after unpaid invoices. */
const PLAN_END_REASONS = ["canceled", "unpaid"] as const;
export type PlanEndReason = (typeof PLAN_END_REASONS)[number];
/** The client that verified the sign-in code that created the account. */
const ACCOUNT_SURFACES = ["desktop", "mobile", "web"] as const;
export type AccountSurface = (typeof ACCOUNT_SURFACES)[number];
/** Where the account service learned the first touch of an account. */
const ATTRIBUTION_SOURCES = ["sign_in", "checkout"] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

export type AccountAnalyticsEvent =
  | {
      name: "billing_action";
      action: BillingAction;
      /** Absent means `server`, as in generation 10. */
      product?: BillingProduct;
      plan?: BillingPlanId;
      /** For a license: the number of users that it pays for. */
      users?: number;
      /** On `plan_changed`. */
      direction?: PlanChangeDirection;
      /** On `checkout_started`: where the journey started in the app. */
      entryPoint?: HostedServerEntryPoint;
      interval?: BillingInterval;
      currency?: BillingCurrency;
      /** Minor units of `currency`, from Stripe. */
      amount?: number | null;
      flow?: (typeof PORTAL_FLOWS)[number];
      /** On `plan_started`: the account had a plan before that ended. */
      reactivated?: boolean;
      /** On `plan_ended`. */
      endReason?: PlanEndReason;
    }
  | { name: "account_created"; surface: AccountSurface; firstTouch: FirstTouch | null }
  | { name: "account_attributed"; via: AttributionSource; firstTouch: FirstTouch }
  | {
      name: "hosted_server_action";
      action: HostedServerAction;
      plan?: BillingPlanId;
      size?: HostedServerSize;
      reason?: (typeof WAKE_REASONS)[number];
      error?: HostedServerError | null;
    };

/** Account events that only the Worker sees: new accounts, payments and hosted servers. */
export interface AccountAnalytics {
  /** Never throws and never waits: a failed send loses the event, not the request. */
  track(accountId: string, event: AccountAnalyticsEvent): void;
}

export const NO_ACCOUNT_ANALYTICS: AccountAnalytics = { track: () => undefined };

export interface AccountAnalyticsOptions {
  /**
   * A server client of the OpenPanel project and its write-only secret. The desktop and website
   * client has no secret. Without both, no event is sent.
   */
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  /** Keeps the Worker alive until the send ends (`waitUntil`). */
  schedule: (send: Effect.Effect<void>) => void;
}

/** This fork sends no account analytics. */
export function createAccountAnalytics(_options: AccountAnalyticsOptions): AccountAnalytics {
  return NO_ACCOUNT_ANALYTICS;
}

const FIRST_TOUCH_CAMPAIGN_PROPERTIES = {
  utmSource: "first_touch_utm_source",
  utmMedium: "first_touch_utm_medium",
  utmCampaign: "first_touch_utm_campaign",
  utmContent: "first_touch_utm_content",
  utmTerm: "first_touch_utm_term",
} as const satisfies Record<(typeof FIRST_TOUCH_CAMPAIGN_FIELDS)[number], string>;

/** The event properties of a first touch, checked again; empty without a valid one. */
export function firstTouchProperties(value: FirstTouch | null): Record<string, string> {
  const touch = parseFirstTouch(value);
  if (!touch) return {};
  const properties: Record<string, string> = {
    first_touch_source: touch.acquisitionSource,
    first_touch_platform: touch.sourcePlatform,
    first_touch_landing_page: touch.landingPage,
    first_touch_date: touch.firstVisitOn,
  };
  for (const field of FIRST_TOUCH_CAMPAIGN_FIELDS) {
    const campaign = touch[field];
    if (campaign) properties[FIRST_TOUCH_CAMPAIGN_PROPERTIES[field]] = campaign;
  }
  return properties;
}
