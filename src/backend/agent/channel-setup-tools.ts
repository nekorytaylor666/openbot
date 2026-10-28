import { randomUUID } from "node:crypto";
import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import { type Channel, type ChannelCommand, type ChannelDraft, isChannelDraft } from "@openbot/contracts/ipc";
import { Effect } from "effect";
import { z } from "zod";
import type { ChannelOperationError } from "../channel-effects";
import type { SidebarLayoutStore } from "../sidebar-layout-store";
import { openBotToolResult } from "./routine-tools";
import { ToolOperationFailed, toolStep, toToolOperationFailed } from "./tool-operation";

const agentId = z.string().min(1).max(INPUT_LIMITS.identifier);
const memberIds = z.array(agentId).min(1).max(INPUT_LIMITS.agents);
const channelFields = {
  name: z.string().trim().min(1).max(INPUT_LIMITS.agentName),
  title: z.string().trim().max(INPUT_LIMITS.agentTitle).optional(),
  instructions: z
    .string()
    .trim()
    .max(INPUT_LIMITS.agentDescription)
    .describe("Standing instructions every member reads in this channel.")
    .optional(),
  leadAgentId: agentId
    .describe("Member that receives requests nobody is mentioned in. Omit to use the first member.")
    .optional(),
};

export const createChannelToolSchema = z
  .object({ ...channelFields, memberAgentIds: memberIds.describe("Stable agent ids from list_agents.") })
  .strict();

export const createTeamToolSchema = z
  .object({
    ...channelFields,
    name: z.string().trim().min(1).max(INPUT_LIMITS.sidebarSectionName),
    agentIds: memberIds.describe("Stable agent ids from list_agents. Each moves into the team's sidebar section."),
    channel: z.boolean().describe("Also open a team channel with these agents. Default true.").optional(),
  })
  .strict();

export const CHANNEL_SETUP_TOOL_NAMES: ReadonlySet<string> = new Set([
  "list_channels",
  "create_channel",
  "create_team",
]);

export interface ChannelSetupDeps {
  channels: {
    command(
      command: ChannelCommand,
      actor: { id: string; name: string },
    ): Effect.Effect<Channel, ChannelOperationError>;
    store: { list(memberId: string, signedOutMessagesAreTheirs?: boolean): Channel[] };
  };
  actor: { id: string; name: string };
  sidebar: Pick<SidebarLayoutStore, "getSnapshot" | "mutate"> | null;
  agentIds: ReadonlySet<string>;
}

function channelView(channel: Channel) {
  return {
    id: channel.id,
    name: channel.name,
    title: channel.title,
    instructions: channel.instructions,
    memberAgentIds: channel.members.map((member) => member.agentId),
    leadAgentId: channel.leadAgentId,
    archived: channel.archived,
  };
}

const saveChannel = Effect.fn("ChannelSetupTools.saveChannel")(function* (
  deps: ChannelSetupDeps,
  input: z.infer<typeof createChannelToolSchema>,
) {
  const members = [...new Set(input.memberAgentIds)];
  const unknown = members.filter((id) => !deps.agentIds.has(id));
  if (unknown.length > 0)
    return yield* new ToolOperationFailed({ cause: new Error(`Unknown agent ids: ${unknown.join(", ")}.`) });
  if (input.leadAgentId && !members.includes(input.leadAgentId))
    return yield* new ToolOperationFailed({ cause: new Error("leadAgentId must be one of the members.") });
  const draft: ChannelDraft = {
    name: input.name,
    title: input.title ?? "",
    instructions: input.instructions ?? "",
    members: members.map((id) => ({ agentId: id })),
    leadAgentId: input.leadAgentId ?? members[0] ?? null,
  };
  if (!isChannelDraft(draft)) return yield* new ToolOperationFailed({ cause: new Error("The channel is invalid.") });
  return yield* deps.channels
    .command({ type: "save", operationId: randomUUID(), channelId: randomUUID(), draft }, deps.actor)
    .pipe(toToolOperationFailed);
});

const createTeam = Effect.fn("ChannelSetupTools.createTeam")(function* (
  deps: ChannelSetupDeps,
  input: z.infer<typeof createTeamToolSchema>,
) {
  const sidebar = deps.sidebar;
  if (!sidebar) return yield* new ToolOperationFailed({ cause: new Error("Sidebar sections are unavailable.") });
  const unknown = input.agentIds.filter((id) => !deps.agentIds.has(id));
  if (unknown.length > 0)
    return yield* new ToolOperationFailed({ cause: new Error(`Unknown agent ids: ${unknown.join(", ")}.`) });
  const before = new Set(sidebar.getSnapshot().sections.map((section) => section.id));
  const created = yield* sidebar
    .mutate({ type: "create", name: input.name }, deps.agentIds)
    .pipe(toToolOperationFailed);
  const section = created.sections.find((candidate) => !before.has(candidate.id));
  if (!section) return yield* new ToolOperationFailed({ cause: new Error("The team section was not created.") });
  for (const id of new Set(input.agentIds))
    yield* sidebar
      .mutate({ type: "assign", agentId: id, sectionId: section.id }, deps.agentIds)
      .pipe(toToolOperationFailed);
  const channel =
    input.channel === false
      ? null
      : yield* saveChannel(deps, {
          name: section.name,
          title: input.title,
          instructions: input.instructions,
          leadAgentId: input.leadAgentId,
          memberAgentIds: input.agentIds,
        });
  return { section, agentIds: [...new Set(input.agentIds)], channel: channel ? channelView(channel) : null };
});

/** `list_channels`, `create_channel` and `create_team`; null for any other tool. */
export const handleChannelSetupTool = Effect.fn("ChannelSetupTools.handle")(function* (
  tool: string,
  args: unknown,
  deps: ChannelSetupDeps,
) {
  switch (tool) {
    case "list_channels":
      return openBotToolResult({
        channels: deps.channels.store
          .list(deps.actor.id, true)
          .filter((channel) => !channel.archived)
          .map(channelView),
      });
    case "create_channel": {
      const input = yield* toolStep(() => createChannelToolSchema.parse(args ?? {}));
      return openBotToolResult({ channel: channelView(yield* saveChannel(deps, input)) });
    }
    case "create_team": {
      const input = yield* toolStep(() => createTeamToolSchema.parse(args ?? {}));
      return openBotToolResult(yield* createTeam(deps, input));
    }
    default:
      return null;
  }
});
