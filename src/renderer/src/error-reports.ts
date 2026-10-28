import type { CentralAuthUser } from "@openbot/contracts/ipc";
import type { FailureProperties } from "@openbot/telemetry";

// This fork sends no failure reports. The functions stay so callers need no changes.

export function configureWebReports(_user: Pick<CentralAuthUser, "id" | "email"> | null): void {}

export function reportNotification(_properties: FailureProperties): void {}

export function reportErrorBanner(_error: unknown, _operation: FailureProperties["operation"] = "other"): void {}
