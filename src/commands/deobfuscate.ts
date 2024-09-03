import { basename } from "node:path";

import { Command, Option } from "@commander-js/extra-typings";
import format from "string-template";

import {
  guessNewIdentifierName as _guessNewIdentifierName,
  saveCache,
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
  .action(async (file: string, options) => {
    const inputFile = Bun.file(file);
    const content = await inputFile.text();

    const deobfuscated = await deobfuscate(content, {
      aiOptions: {
        supportsJsonSchema: options.jsonSchema,
      },

      maxFunctionLength: options.maxFunctionLength,
    });

    if (options.output === "-") {
      console.log(deobfuscated.content);
    } else {
      const output = format(
        options.output,
        Object.defineProperties(
          {},
          {
            filename: {
              get() {
                return basename(file);
              },
            },
            hash: {
              get() {
                return Bun.hash(content).toString(36);
              },
            },
            model: { value: options.model },
          },
        ),
      );

      await Bun.write(output, deobfuscated.content);
    }

    if (options.cache) {
      await saveCache();
    }
  });
