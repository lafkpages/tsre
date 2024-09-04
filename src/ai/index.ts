import type { BunFile } from "bun";
import type { AIOptions } from "./common";
import type { AIProcOptions } from "./proc";

import { join } from "node:path";

import consola from "consola";

import { defaultAiProcOptions } from "./common";

// prettier-ignore
type CacheData = Record<string, AIResult>;
// prettier-ignore
export type RequiredAIProcOptions = Required<AIProcOptions>;

export class AI {
  model;
  supportsJsonSchema;

  cache;

  constructor(opts: AIOptions) {
    this.model = opts.model || defaultAiProcOptions.model;
    this.supportsJsonSchema =
      opts.supportsJsonSchema ?? defaultAiProcOptions.supportsJsonSchema;

    this.cache = opts.cache;
  }

  guessNewIdentifierName(
    usedBindings: string[],
    identifierType: string,
    data: string,
    context: string | false,
  ): AIGuess {
    let cacheHash: number;
    if (this.cache) {
      cacheHash = getCacheHash(identifierType, data, context || "");
      const cached = this.cache.cacheData.get(cacheHash);

      if (cached) {
        return {
          ...cached,
          additionalProgramContext:
            context === false ? null : cached.additionalProgramContext,
          cacheHit: true,
        };
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
        JSON.stringify(context),
        JSON.stringify({
          model: this.model,
          supportsJsonSchema: this.supportsJsonSchema,
        } satisfies RequiredAIProcOptions),
      ],
    });

    if (proc.success) {
      const result = JSON.parse(proc.stdout.toString()) as AIResult;

      if (this.cache) {
        this.cache.cacheData.set(cacheHash!, result);
      }

      return {
        ...result,
        cacheHit: false,
      };
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
    consola.debug("Saving AI cache");

    const cacheData: CacheData = {};

    for (const [key, value] of this.cacheData) {
      cacheData[key] = value;
    }

    await Bun.write(this.cacheFile, JSON.stringify(cacheData));
  }
}

export interface AIResult {
  newName: string;
  additionalProgramContext?: string | null;
}

export interface AIGuess extends AIResult {
  cacheHit: boolean;
}

function getCacheHash(identifierType: string, data: string, context: string) {
  return Bun.hash.adler32(`${identifierType}:${data}:${context}`);
}
