import { Effect, Schema } from "effect";

// This fork sends no sales analytics. The class keeps its interface so billing code needs no changes.

export type SalesAnalyticsProperties = Record<string, string | number>;

export interface SalesAnalyticsDrainSummary {
  claimed: number;
  sent: number;
  rejected: number;
  uncertain: number;
  pending: number;
}

export class SalesAnalyticsDeliveryError extends Schema.TaggedError<SalesAnalyticsDeliveryError>()(
  "SalesAnalyticsDeliveryError",
  {
    code: Schema.Literals(["invalid_event", "database", "delivery"]),
  },
) {}

export interface SalesAnalyticsDeliveryOptions {
  database: D1Database;
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
}

export class SalesAnalyticsDelivery {
  constructor(_options: SalesAnalyticsDeliveryOptions) {}

  enqueue(
    _sourceKey: string,
    _profileId: string | null,
    _name: string,
    _properties: SalesAnalyticsProperties,
    _timestamp: number,
  ): Effect.Effect<void, SalesAnalyticsDeliveryError> {
    return Effect.void;
  }

  drain(): Effect.Effect<SalesAnalyticsDrainSummary, SalesAnalyticsDeliveryError> {
    return Effect.succeed({ claimed: 0, sent: 0, rejected: 0, uncertain: 0, pending: 0 });
  }
}
