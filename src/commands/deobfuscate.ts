import { Command, Option } from "@commander-js/extra-typings";

import {
  guessNewIdentifierName as _guessNewIdentifierName,
  saveCache,
} from "../ai";
import { deobfuscate } from "../deobfuscate";

export default new Command("deobfuscate")
  .arguments("<file>")
  .option("-o, --output <file>", "output file", "-")
  .addOption(
    new Option(
      "-m, --max-function-length <number>",
      "maximum function length that will be sent to AI",
    )
      .argParser(parseInt)
      .default(500),
  )
  .option("--no-cache", "do not use cache", false)
  .action(async (file: string, options) => {
    console.debug(options);

    const inputFile = Bun.file(file);
    const content = await inputFile.text();

    const deobfuscated = await deobfuscate(content, {
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
