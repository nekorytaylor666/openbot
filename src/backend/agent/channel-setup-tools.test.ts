import type { Channel, ChannelCommand, SidebarLayoutAction, SidebarLayoutSnapshot } from "@openbot/contracts/ipc";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { type ChannelSetupDeps, handleChannelSetupTool } from "./channel-setup-tools";

function fakeDeps() {
  const commands: ChannelCommand[] = [];
  const actions: SidebarLayoutAction[] = [];
  let layout: SidebarLayoutSnapshot = { revision: 0, sections: [], order: [], agentAssignments: {}, agentOrder: [] };
  const deps: ChannelSetupDeps = {
    actor: { id: "local", name: "You" },
    agentIds: new Set(["a", "b"]),
    channels: {
      store: { list: () => [] },
      command: (command: ChannelCommand) => {
        commands.push(command);
        if (command.type !== "save") return Effect.die("unexpected");
        const channel: Channel = {
          ...command.draft,
          id: command.channelId,
          archived: false,
          revision: 1,
          createdAt: "",
        };
        return Effect.succeed(channel);
      },
    },
    sidebar: {
      getSnapshot: () => layout,
      mutate: (action: SidebarLayoutAction) => {
        actions.push(action);
        if (action.type === "create")
          layout = { ...layout, sections: [...layout.sections, { id: "s1", name: action.name }] };
        return Effect.succeed(layout);
      },
    },
  };
  return { deps, commands, actions };
}

const run = (tool: string, args: unknown, deps: ChannelSetupDeps) =>
  Effect.runPromise(handleChannelSetupTool(tool, args, deps));

describe("channel setup tools", () => {
  it("creates a channel led by the first member by default", async () => {
    const { deps, commands } = fakeDeps();
    const result = await run("create_channel", { name: "Evals", memberAgentIds: ["a", "b"] }, deps);
    expect(result?.success).toBe(true);
    const save = commands[0];
    expect(save?.type === "save" && save.draft).toMatchObject({
      name: "Evals",
      leadAgentId: "a",
      members: [{ agentId: "a" }, { agentId: "b" }],
    });
  });

  it("refuses unknown members and a lead outside the members", async () => {
    const { deps } = fakeDeps();
    await expect(run("create_channel", { name: "X", memberAgentIds: ["zzz"] }, deps)).rejects.toThrow();
    await expect(run("create_channel", { name: "X", memberAgentIds: ["a"], leadAgentId: "b" }, deps)).rejects.toThrow();
  });

  it("creates a team section, assigns its agents and opens its channel", async () => {
    const { deps, actions, commands } = fakeDeps();
    const result = await run("create_team", { name: "Evals team", agentIds: ["a", "b"], leadAgentId: "b" }, deps);
    expect(actions.map((action) => action.type)).toEqual(["create", "assign", "assign"]);
    expect(commands).toHaveLength(1);
    expect(JSON.parse(result?.contentItems[0]?.text ?? "{}")).toMatchObject({
      section: { id: "s1", name: "Evals team" },
      channel: { name: "Evals team", leadAgentId: "b", memberAgentIds: ["a", "b"] },
    });
  });

  it("ignores other tools", async () => {
    const { deps } = fakeDeps();
    expect(await run("list_sections", {}, deps)).toBeNull();
  });
});
