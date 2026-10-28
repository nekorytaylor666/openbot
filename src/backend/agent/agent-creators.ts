import { readFile } from "node:fs/promises";
import { type DynamicRecord, isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Effect, Semaphore } from "effect";
import { writeJsonFileAtomically } from "../atomic-json-file";
import { isMissingFileError } from "../file-errors";
import { StoredStateFailure, storedIO } from "../stored-state-effects";

/** Unreadable JSON counts as no record: the worst case is that an agent cannot delete its old workers. */
function parseCreators(text: string): Map<string, string> {
  let stored: DynamicRecord | null = null;
  try {
    const value = JSON.parse(text);
    stored = isDynamicRecord(value) ? value : null;
  } catch {
    return new Map();
  }
  const creators = stored && isDynamicRecord(stored.creators) ? stored.creators : {};
  return new Map(Object.entries(creators).filter((entry): entry is [string, string] => isString(entry[1])));
}

export const AGENT_CREATORS_FILE = "openbot-agent-creators-v1.json";

/** Which agent created which agent with create_agent, so an agent may delete only the agents it created. */
export class AgentCreators {
  readonly #path: string | null;
  readonly #queue = Semaphore.makeUnsafe(1);
  #creators: Map<string, string> | null = null;

  /** A null path keeps the record in memory only. */
  constructor(path: string | null) {
    this.#path = path;
  }

  creatorOf(agentId: string): Effect.Effect<string | null, StoredStateFailure> {
    return this.#queue.withPermit(this.#load().pipe(Effect.map((creators) => creators.get(agentId) ?? null)));
  }

  record(agentId: string, creatorAgentId: string): Effect.Effect<void, StoredStateFailure> {
    return this.#change((creators) => creators.set(agentId, creatorAgentId));
  }

  forget(agentId: string): Effect.Effect<void, StoredStateFailure> {
    return this.#change((creators) => creators.delete(agentId));
  }

  #change(update: (creators: Map<string, string>) => void): Effect.Effect<void, StoredStateFailure> {
    return this.#queue.withPermit(
      Effect.gen({ self: this }, function* () {
        const creators = yield* this.#load();
        update(creators);
        const path = this.#path;
        if (path === null) return;
        yield* writeJsonFileAtomically(
          path,
          { version: 1, creators: Object.fromEntries(creators) },
          { createDirectory: true },
        ).pipe(Effect.mapError(({ cause }) => new StoredStateFailure({ cause })));
      }).pipe(Effect.uninterruptible),
    );
  }

  #load(): Effect.Effect<Map<string, string>, StoredStateFailure> {
    const loaded = this.#creators;
    if (loaded) return Effect.succeed(loaded);
    const path = this.#path;
    return Effect.gen({ self: this }, function* () {
      const text =
        path === null
          ? null
          : yield* storedIO(() => readFile(path, "utf8")).pipe(
              Effect.catch((failure) =>
                isMissingFileError(failure.cause) ? Effect.succeed(null) : Effect.fail(failure),
              ),
            );
      const creators = text === null ? new Map<string, string>() : parseCreators(text);
      this.#creators = creators;
      return creators;
    });
  }
}
