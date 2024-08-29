import { join } from "node:path";

const cache = new Map<string, Map<string, string>>();
const cacheFile = Bun.file("./.cache/ai.json");

try {
  const cacheData = (await cacheFile.json()) as Record<
    string,
    Record<string, string>
  >;

  for (const [key, value] of Object.entries(cacheData)) {
    const subCache = new Map<string, string>();

    for (const [subKey, subValue] of Object.entries(value)) {
      subCache.set(subKey, subValue);
    }

    cache.set(key, subCache);
  }
} catch (error) {
  console.error("Failed to load cache", error);
}

export async function saveCache() {
  const cacheData: Record<string, Record<string, string>> = {};

  for (const [key, value] of cache.entries()) {
    const subCache: Record<string, string> = {};

    for (const [subKey, subValue] of value.entries()) {
      subCache[subKey] = subValue;
    }

    cacheData[key] = subCache;
  }

  await Bun.write(cacheFile, JSON.stringify(cacheData));
}

export function guessNewIdentifierName(
  identifierType: string,
  context: string,
) {
  const cached = cache.get(identifierType)?.get(context);
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

    let subCache = cache.get(identifierType);
    if (!subCache) {
      subCache = new Map();
      cache.set(identifierType, subCache);
    }

    subCache.set(context, newName);
    return newName;
  }

  throw new Error(
    `Failed to execute sync Bun process for getNewFunctionName (exit code ${proc.exitCode}):\n${proc.stderr.toString()}`,
  );
}
