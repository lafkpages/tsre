import { format } from "prettier";
import {
  ScriptKind,
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isIdentifier,
  type Node,
  type TextChange,
} from "typescript";

import { transformers, type SymbolsRenameMap } from "./transformers";

const inputFile = Bun.file(process.argv[2]);

// Create an update array
const updates: TextChange[] = [];

// Symbols to rename
const symbolsToRename: SymbolsRenameMap = new Map();

// Using a node visitor to find and rename symbols
const visit = async (node: Node) => {
  // Renaming symbols
  if (isIdentifier(node) && symbolsToRename.has(node.text)) {
    const textChange: TextChange = {
      span: {
        start: node.getStart(),
        length: node.getWidth(),
      },
      newText: symbolsToRename.get(node.text)!,
    };

    updates.push(textChange);
  } else {
    for (const transformer of transformers) {
      if (transformer.accepts(node)) {
        const [symbols, textChanges] = await transformer.transform(node);

        if (symbols) {
          for (const [oldName, newName] of symbols) {
            symbolsToRename.set(oldName, newName);
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

// let content = await format(await inputFile.text(), {
//   parser: "typescript",
//   filepath: inputFile.name,
// });
let content = await inputFile.text();

let i = 0;
while (i < 3) {
  console.log("Iteration", i);

  // Read the file
  const sourceFile = createSourceFile(
    inputFile.name!,
    content,
    ScriptTarget.Latest,
    true,
    ScriptKind.JS
  );

  console.debug("Symbols to rename:", symbolsToRename);

  await visit(sourceFile);

  if (!updates.length) {
    break;
  }

  // Apply changes to the file content
  updates.reverse().forEach((change) => {
    content =
      content.slice(0, change.span.start) +
      change.newText +
      content.slice(change.span.start + change.span.length);
  });
  updates.length = 0;

  i++;
}

await Bun.write("out.cjs", content);
