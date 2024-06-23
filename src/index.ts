import { format } from "prettier";
import {
  ScriptTarget,
  SyntaxKind,
  createSourceFile,
  forEachChild,
  isFunctionDeclaration,
  isReturnStatement,
  type Node,
  type TextChange,
} from "typescript";

const inputFile = Bun.file(process.argv[2]);

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
const visit = async (node: Node) => {
  // Renaming symbols
  // if (isIdentifier(node) && node.text === originalName) {
  //   updates.push({
  //     span: { start: node.getStart(), length: node.getWidth() },
  //     newText: newName,
  //   });
  // }

  if (isFunctionDeclaration(node) && node.name) {
    const functionSize = node.getEnd() - node.getStart();

    if (functionSize <= 300) {
      if (node.body) {
        if (node.body.statements.length === 1 && node.name.getText() === "ve") {
          const returnStatement = node.body.statements[0];

          console.log(
            "params:",
            node.parameters.map((p) => p.name.getText())
          );

          console.log("returnStatement:", returnStatement.getText());

          if (returnStatement && isReturnStatement(returnStatement)) {
            if (returnStatement.expression) {
              console.log(
                "return expression:",
                returnStatement.expression.getText()
              );
            } else {
              // rename all of the function's references to undefined
            }
          }
        }
      }

      // const prettyFunction = await format(node.getFullText(), {
      //   parser: "typescript",
      // });

      // // send to llm
      // console.log("function size: ", functionSize);
      // console.log(prettyFunction);
    }
  }

  const promises: Promise<void>[] = [];

  forEachChild(node, (childNode) => {
    promises.push(visit(childNode));
  });

  await Promise.all(promises);
};

await visit(sourceFile);

// Apply changes to the file content
let content = sourceFile.getFullText();
updates.reverse().forEach((change) => {
  content =
    content.slice(0, change.span.start) +
    change.newText +
    content.slice(change.span.start + change.span.length);
});

await Bun.write("out.cjs", content);
