import type { CentralAuthUser } from "@openbot/contracts/ipc";
import { version } from "../../../../../package.json";
import { type DesktopAnalyticsProperties, desktopAnalytics } from "../../analytics";

/** A no-op in this fork: the web client sends no product analytics. */
export function configureWebAnalytics(account: CentralAuthUser | null): void {
  desktopAnalytics.configureWeb({ version, user: account, enabled: false });
}

/** A no-op in this fork. */
export function trackBillingReturn(event: DesktopAnalyticsProperties<"billing_return_viewed">): void {
  desktopAnalytics.track("billing_return_viewed", event);
}
