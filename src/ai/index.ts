import { join } from "node:path";

const cache = new Map<number, string>();
const cacheFile = Bun.file("./.cache/ai.json");

// prettier-ignore
type CacheData = Record<number, string>;

try {
  const cacheData = (await cacheFile.json()) as CacheData;

  for (const [key, value] of Object.entries(cacheData)) {
    cache.set(parseInt(key), value);
  }
} catch (error) {
  console.error("Failed to load cache", error);
}

export async function saveCache() {
  const cacheData: CacheData = {};

  for (const [key, value] of cache) {
    cacheData[key] = value;
  }

  await Bun.write(cacheFile, JSON.stringify(cacheData));
}

function getCacheHash(identifierType: string, context: string) {
  return Bun.hash.adler32(`${identifierType}:${context}`);
}

export function guessNewIdentifierName(
  identifierType: string,
  context: string,
) {
  const cacheHash = getCacheHash(identifierType, context);
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
      identifierType,
      context,
    ],
  });

  if (proc.success) {
    const newName = proc.stdout.toString().trim();

    cache.set(cacheHash, newName);

    return newName;
  }

  throw new Error(
    `Failed to execute sync Bun process for getNewFunctionName (exit code ${proc.exitCode}):\n${proc.stderr.toString()}`,
  );
}
