import { Command, Option } from "@commander-js/extra-typings";

import {
  guessNewIdentifierName as _guessNewIdentifierName,
  defaultAiOptions,
  saveCache,
} from "../ai";
import { deobfuscate } from "../deobfuscate";

export default new Command("deobfuscate")
  .arguments("<file>")
  .option("-o, --output <file>", "output file", "-")
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
      await Bun.write(options.output, deobfuscated.content);
    }

    if (options.cache) {
      await saveCache();
    }
  });
