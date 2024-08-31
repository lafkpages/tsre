import { program } from "commander";

import { version } from "../package.json";
import { commands } from "./commands";

program.name("tsre").version(version);

for (const command of commands) {
  program.addCommand(command);
}

program.parse();
