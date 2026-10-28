import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { piSkillArguments } from "../home-skills";
import { AgentCreators } from "./agent-creators";

describe("agent creators", () => {
  it("keeps who created an agent across restarts until the agent is forgotten", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "creators-")), "creators.json");
    await Effect.runPromise(new AgentCreators(path).record("worker", "lead"));
    const reloaded = new AgentCreators(path);
    expect(await Effect.runPromise(reloaded.creatorOf("worker"))).toBe("lead");
    await Effect.runPromise(reloaded.forget("worker"));
    expect(await Effect.runPromise(new AgentCreators(path).creatorOf("worker"))).toBeNull();
  });

  it("treats a corrupt file as no record", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "creators-")), "creators.json");
    await writeFile(path, "{not json");
    expect(await Effect.runPromise(new AgentCreators(path).creatorOf("worker"))).toBeNull();
  });
});

describe("pi skill arguments", () => {
  it("adds nothing without an OpenBot skill folder", async () => {
    const home = await mkdtemp(join(tmpdir(), "home-"));
    expect(await Effect.runPromise(piSkillArguments(home))).toEqual([]);
  });

  it("loads the OpenBot copy before the listed folders", async () => {
    const home = await mkdtemp(join(tmpdir(), "home-"));
    const folder = join(home, ".agents/openbot-skills");
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, ".pi-skill-roots"),
      `/u/.agents/skills\n\nrelative/ignored\n${folder}\n/u/pkg/skills\n`,
    );
    expect(await Effect.runPromise(piSkillArguments(home))).toEqual([
      "--no-skills",
      "--skill",
      folder,
      "--skill",
      "/u/.agents/skills",
      "--skill",
      "/u/pkg/skills",
    ]);
  });
});
