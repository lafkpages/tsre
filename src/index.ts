import { program } from "commander";
import { consola, LogLevels } from "consola";

import { version } from "../package.json";
import { commands } from "./commands";

program
  .name("tsre")
  .version(version)
  .option("-v, --verbose", "enable verbose mode")
  .hook("preAction", (command) => {
    const { verbose } = command.opts<{
      verbose: boolean;
    }>();

    if (verbose) {
      consola.level = LogLevels.debug;
    }
  });

for (const command of commands) {
  program.addCommand(command);
}

program.parse();
