import type { BunFile } from "bun";
import type { AIOptions } from "./common";

import { join } from "node:path";

const cache = new Map<number, AIResult>();

// prettier-ignore
type CacheData = Record<string, AIResult>;

export async function loadAiCache(file: BunFile) {
  const cacheData = (await file.json()) as CacheData;

  for (const [key, value] of Object.entries(cacheData)) {
    cache.set(parseInt(key), value);
  }
}

export async function saveAiCache(file: BunFile) {
  const cacheData: CacheData = {};

  for (const [key, value] of cache) {
    cacheData[key] = value;
  }

  await Bun.write(file, JSON.stringify(cacheData));
}

function getCacheHash(identifierType: string, data: string, context: string) {
  return Bun.hash.adler32(`${identifierType}:${data}:${context}`);
}

export interface AIResult {
  newName: string;
  additionalProgramContext?: string;
}

export function guessNewIdentifierName(
  usedBindings: string[],
  identifierType: string,
  data: string,
  context?: string,
  opts?: AIOptions,
) {
  context ||= "";

  const cacheHash = getCacheHash(identifierType, data, context);
  const cached = cache.get(cacheHash);
  if (cached) {
    return cached;
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
      opts ? JSON.stringify(opts) : "{}",
      context,
    ],
  });

  if (proc.success) {
    const result = JSON.parse(proc.stdout.toString()) as AIResult;

    cache.set(cacheHash, result);

    return result;
  }

  throw new Error(
    `Failed to execute sync Bun process for getNewFunctionName (exit code ${proc.exitCode}):\n${proc.stderr.toString()}`,
  );
}
