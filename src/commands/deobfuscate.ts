import { basename } from "node:path";

import { Command, Option } from "@commander-js/extra-typings";
import format from "string-template";

import { AI, AICache } from "../ai";
import { defaultAiProcOptions } from "../ai/common";
import { deobfuscate } from "../deobfuscate";

export default new Command("deobfuscate")
  .arguments("<file>")
  .option(
    "-o, --output <file>",
    "output file. Templates like {filename}, {hash} and {model} can be used",
    "-",
  )
  .addOption(
    new Option(
      "--max-function-length <number>",
      "maximum function length that will be sent to AI",
    )
      .argParser(parseInt)
      .default(500),
  )
  .option("-m, --model <model>", "AI model to use", defaultAiProcOptions.model)
  .option("--no-cache", "do not use cache", true)
  .option(
    "--no-json-schema",
    "do not use the json_schema response_format, some APIs, like llama-server, do not support it",
    defaultAiProcOptions.supportsJsonSchema,
  )
  .action(
    async (
      inputFilePath: string,
      {
        model,
        jsonSchema: supportsJsonSchema,
        maxFunctionLength,
        output: outputFilePath,
        cache: useCache,
      },
    ) => {
      const inputFile = Bun.file(inputFilePath);
      const inputContent = await inputFile.text();

      let aiCache: AICache | null = null;

      if (useCache) {
        aiCache = new AICache(Bun.file(`./.cache/${model}/ai.json`));

        await aiCache.load().catch((err) => {
          console.warn("Failed to load cache:", err);
        });
      }

      const ai = new AI({
        model,
        supportsJsonSchema,
        cache: aiCache,
      });

      const deobfuscated = await deobfuscate(inputContent, ai, {
        maxFunctionLength: maxFunctionLength,
      });

      if (outputFilePath === "-") {
        console.log(deobfuscated.content);
      } else {
        outputFilePath = format(
          outputFilePath,
          Object.defineProperties(
            {},
            {
              filename: {
                get() {
                  return basename(inputFilePath);
                },
              },
              hash: {
                get() {
                  return Bun.hash(inputContent).toString(36);
                },
              },
              model: { value: model },
            },
          ),
        );

        await Bun.write(outputFilePath, deobfuscated.content);
      }

      await aiCache?.save();
    },
  );
