import { MobileAnalytics } from "./analytics-core";

// This fork sends no mobile analytics and no failure reports: there is no client and no queue.
export const mobileAnalytics = new MobileAnalytics(
  () => null,
  () => undefined,
);
