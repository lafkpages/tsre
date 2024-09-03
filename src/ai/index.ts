import type { BunFile } from "bun";
import type { AIOptions } from "./common";

import { join } from "node:path";

import { defaultAiOptions } from "./common";

// prettier-ignore
type CacheData = Record<string, AIResult>;
// prettier-ignore
type RequiredAIOptions = Required<AIOptions>;

export class AI {
  model;
  supportsJsonSchema;

  cache;

  constructor(
    opts: AIOptions & {
      cache?: AICache | null;
    },
  ) {
    this.model = opts.model || defaultAiOptions.model;
    this.supportsJsonSchema =
      opts.supportsJsonSchema ?? defaultAiOptions.supportsJsonSchema;

    this.cache = opts.cache;
  }

  guessNewIdentifierName(
    usedBindings: string[],
    identifierType: string,
    data: string,
    context?: string,
  ) {
    context ||= "";

    let cacheHash: number;
    if (this.cache) {
      cacheHash = getCacheHash(identifierType, data, context);
      const cached = this.cache.cacheData.get(cacheHash);

      if (cached) {
        return cached;
      }
    }

    const proc = Bun.spawnSync({
      cmd: [
        process.execPath,
        "run",
        join(__dirname, "proc.ts"),
        "--",
        usedBindings.join(","),
        identifierType,
        data,
        JSON.stringify({
          model: this.model,
          supportsJsonSchema: this.supportsJsonSchema,
        } satisfies RequiredAIOptions),
        context,
      ],
    });

    if (proc.success) {
      const result = JSON.parse(proc.stdout.toString()) as AIResult;

      if (this.cache) {
        this.cache.cacheData.set(cacheHash!, result);
      }

      return result;
    }

    throw new Error(
      `Failed to execute sync Bun process for getNewFunctionName (exit code ${proc.exitCode}):\n${proc.stderr.toString()}`,
    );
  }
}

export class AICache {
  cacheData = new Map<number, AIResult>();
  private cacheFile;

  constructor(cacheFile: BunFile) {
    this.cacheFile = cacheFile;
  }

  async load() {
    const cacheData = (await this.cacheFile.json()) as CacheData;

    for (const [key, value] of Object.entries(cacheData)) {
      this.cacheData.set(parseInt(key), value);
    }
  }

  async save() {
    const cacheData: CacheData = {};

    for (const [key, value] of this.cacheData) {
      cacheData[key] = value;
    }

    await Bun.write(this.cacheFile, JSON.stringify(cacheData));
  }
}

export interface AIResult {
  newName: string;
  additionalProgramContext?: string;
}

function getCacheHash(identifierType: string, data: string, context: string) {
  return Bun.hash.adler32(`${identifierType}:${data}:${context}`);
}
