import type { BunFile } from "bun";

import { basename } from "node:path";

import { Command, Option } from "@commander-js/extra-typings";
import format from "string-template";

import {
  guessNewIdentifierName as _guessNewIdentifierName,
  loadAiCache,
  saveAiCache,
} from "../ai";
import { defaultAiOptions } from "../ai/common";
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
  .option("-m, --model <model>", "AI model to use", defaultAiOptions.model)
  .option("--no-cache", "do not use cache", true)
  .option(
    "--no-json-schema",
    "do not use the json_schema response_format, some APIs, like llama-server, do not support it",
    defaultAiOptions.supportsJsonSchema,
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

      let cacheFile: BunFile;
      if (useCache) {
        cacheFile = Bun.file(`./.cache/${model}/ai.json`);

        await loadAiCache(cacheFile).catch((err) => {
          console.warn("Failed to load cache:", err);
        });
      }

      const deobfuscated = await deobfuscate(inputContent, {
        aiOptions: {
          supportsJsonSchema,
        },

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

      if (useCache) {
        await saveAiCache(cacheFile!);
      }
    },
  );
