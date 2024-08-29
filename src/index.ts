import {
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isIdentifier,
  type Node,
  type TextChange,
} from "typescript";

import { transformers } from "./transformers";
import { format } from "prettier";

const inputFile = Bun.file("./src/test/dummy.js");

// Create an update array
const updates: TextChange[] = [];

// Symbols to rename
const symbolsToRename: Map<string, [string, number]> = new Map();
const symbolsRenamed: Set<string> = new Set();

// Using a node visitor to find and rename symbols
const visit = async (node: Node) => {
  // Renaming symbols
  if (
    isIdentifier(node) &&
    symbolsToRename.has(node.text) &&
    !symbolsRenamed.has(node.text)
  ) {
    const textChange: TextChange = {
      span: {
        start: node.getStart(),
        length: node.getWidth(),
      },
      newText: symbolsToRename.get(node.text)![0],
    };

    updates.push(textChange);
    symbolsRenamed.add(node.text);
  } else {
    for (const transformer of transformers) {
      if (transformer.accepts(node)) {
        const [symbols, textChanges] = await transformer.transform(node);

        if (symbols) {
          for (const [oldName, newName] of symbols) {
            symbolsToRename.set(oldName, [newName, 0]);
          }
        }

        updates.push(...textChanges);

        break;
      }
    }
  }

  const promises: Promise<void>[] = [];

  forEachChild(node, (childNode) => {
    promises.push(visit(childNode));
  });

  await Promise.all(promises);
};

let content = await format(await inputFile.text(), {
  parser: "typescript",
  filepath: inputFile.name,
});

let i = 0;
while (i < 3) {
  console.log("Iteration", i);

  // Read the file
  const sourceFile = createSourceFile("", content, ScriptTarget.Latest, true);

  symbolsToRename.set("y", ["convertFtoC", 0]);

  // Gather updates from transformers
  await visit(sourceFile);

  // If no updates, we can stop
  if (!updates.length) {
    break;
  }

  // Apply changes to the file content
  for (const update of updates) {
    console.debug("Applying update:", update);

    content =
      content.slice(0, update.span.start) +
      update.newText +
      content.slice(update.span.start + update.span.length);

    // Update the spans of the following updates
    for (const update2 of updates) {
      if (update2.span.start > update.span.start) {
        const offset = update.newText.length - update.span.length;

        console.debug("Offsetting update:", offset, update2);

        update2.span.start += offset;
      }
    }
  }
  updates.length = 0;

  // Ensure that symbols to rename are cleared after
  // two iterations (one partial + one full iteration)
  for (const [key, value] of symbolsToRename) {
    value[1]++;

    if (value[1] >= 2) {
      symbolsToRename.delete(key);
    }
  }

  i++;
}

await Bun.write("out.js", content);
