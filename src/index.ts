import {
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isIdentifier,
  type Node,
  type TextChange,
} from "typescript";

const inputFile = Bun.file(process.argv[2]);

const originalName = "kKi";
const newName = "_renameTest";

// Read the file
const sourceFile = createSourceFile(
  inputFile.name!,
  await inputFile.text(),
  ScriptTarget.Latest,
  true
);

// Create an update array
const updates: TextChange[] = [];

// Using a node visitor to find and rename symbols
const visit = (node: Node) => {
  if (isIdentifier(node) && node.text === originalName) {
    updates.push({
      span: { start: node.getStart(), length: node.getWidth() },
      newText: newName,
    });
  }

  forEachChild(node, visit);
};

visit(sourceFile);

// Apply changes to the file content
let content = sourceFile.getFullText();
updates.reverse().forEach((change) => {
  content =
    content.slice(0, change.span.start) +
    change.newText +
    content.slice(change.span.start + change.span.length);
});

await Bun.write("out.cjs", content);

console.log(`Renamed "${originalName}" to "${newName}"`);
