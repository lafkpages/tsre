import type { NodePath } from "@babel/traverse";
import type { Identifier, VariableDeclarator } from "@babel/types";

import {
  isArrayPattern,
  isForOfStatement,
  isFunctionDeclaration,
  isVariableDeclaration,
  isVariableDeclarator,
} from "@babel/types";
import { format } from "prettier";
import putout from "putout";

import { guessNewIdentifierName, saveCache } from "./ai";

const inputFile = Bun.file("./src/test/dummy.js");
let content = await inputFile.text();

// For some reason, Prettier removes the <string>
// type annotation from the Set, so we have to
// prettier-ignore
const renamed = new Map<number, Set<string>>();

const maxFunctionLength = 500;

// prettier-ignore
type IdentifierNodePath = NodePath<Identifier>;

interface PushData {
  path: IdentifierNodePath;
  newName: string;
}

({ code: content } = putout(content, {
  plugins: [
    [
      "tsre",
      {
        report() {
          return "tsre";
        },

        fix({ path, newName }: PushData) {
          const { name } = path.node;
          path.scope.rename(name, newName);
        },

        traverse({ push: _push }: { push: (data: PushData) => void }) {
          function push(data: PushData) {
            _push(data);

            let scopeRenamed = renamed.get(data.path.scope.uid);

            if (!scopeRenamed) {
              scopeRenamed = new Set();
              renamed.set(data.path.scope.uid, scopeRenamed);
            }

            scopeRenamed.add(data.newName);
          }

          return {
            Identifier(path: IdentifierNodePath) {
              const { name } = path.node;
              if (!path.scope.hasBinding(name)) {
                return;
              }

              const scopeRenamed = renamed.get(path.scope.uid);

              if (scopeRenamed?.has(name)) {
                return;
              }

              console.log("Traversing identifier:", name);

              const container =
                !path.container || "length" in path.container
                  ? null
                  : path.container;

              if (isFunctionDeclaration(container)) {
                if (
                  typeof container.start !== "number" ||
                  typeof container.end !== "number"
                ) {
                  return;
                } else if (
                  container.end - container.start <=
                  maxFunctionLength
                ) {
                  const functionDeclarationText = content.slice(
                    container.start,
                    container.end,
                  );

                  console.log("Asking for new function name", {
                    name,
                    functionDeclarationText,
                  });

                  const newFunctionName = guessNewIdentifierName(
                    "function",
                    functionDeclarationText,
                  );

                  console.log("Got new function name:", {
                    name,
                    newFunctionName,
                  });

                  push({
                    path,
                    newName: newFunctionName,
                  });
                } else {
                  console.log("Function declaration too long, skipping");
                }

                return;
              }

              if (isFunctionDeclaration(path.parent)) {
                if (path.listKey === "params") {
                  if (
                    typeof path.parent.start !== "number" ||
                    typeof path.parent.end !== "number"
                  ) {
                    return;
                  } else if (
                    path.parent.end - path.parent.start <=
                    maxFunctionLength
                  ) {
                    const functionDeclarationText = content.slice(
                      path.parent.start,
                      path.parent.end,
                    );

                    console.log("Asking for new parameter name", {
                      name,
                      functionDeclarationText,
                    });

                    const newParameterName = guessNewIdentifierName(
                      "parameter",
                      `/* rename parameter "${name}" */\n${functionDeclarationText}`,
                    );

                    console.log("Got new parameter name:", {
                      name,
                      newParameterName,
                    });

                    push({
                      path,
                      newName: newParameterName,
                    });
                  } else {
                    console.log(
                      "Function declaration for parameter too long, skipping",
                    );
                  }

                  return;
                }
              }

              {
                const isBaseDeclarator = isVariableDeclarator(path.parent);
                const isArrayDeclarator =
                  isArrayPattern(path.parent) &&
                  isVariableDeclarator(path.parentPath.parent);

                // The ArrayPattern logic allows renaming of destructured variables,
                // e.g. `const [a, b] = [1, 2]`

                // prettier-ignore
                type NodePathVariableDeclarator = NodePath<VariableDeclarator>;

                const declarator = isArrayDeclarator
                  ? (path.parentPath.parent as VariableDeclarator)
                  : isBaseDeclarator
                    ? (path.parent as VariableDeclarator)
                    : null;
                const declaratorPath = isArrayDeclarator
                  ? (path.parentPath.parentPath as NodePathVariableDeclarator)
                  : isBaseDeclarator
                    ? (path.parentPath as NodePathVariableDeclarator)
                    : null;

                if (
                  declarator &&
                  declaratorPath &&
                  isVariableDeclaration(declaratorPath.parent)
                ) {
                  let declarationText: string | null = null;

                  if (isForOfStatement(declaratorPath.parentPath?.parent)) {
                    const start = declaratorPath.parentPath.parent.start;
                    const end = declaratorPath.parentPath.parent.right.end;

                    if (start && end) {
                      declarationText = content.slice(start, end);
                    }
                  } else if (declarator.init) {
                    const start = declaratorPath.parent.start;
                    const end = declaratorPath.parent.end;

                    if (start && end) {
                      declarationText = content.slice(start, end);
                    }
                  }

                  // TODO: Handle other types of variable declarations

                  if (declarationText) {
                    declarationText = `/* rename variable "${name}" */\n${declarationText}`;

                    console.log("Asking for new variable name", {
                      name,
                      declarationText,
                    });

                    const newVariableName = guessNewIdentifierName(
                      "variable",
                      declarationText,
                    );

                    console.log("Got new variable name:", {
                      name,
                      newVariableName,
                    });

                    push({
                      path,
                      newName: newVariableName,
                    });
                  } else {
                    console.log("Variable declaration type not supported");
                  }

                  return;
                }
              }

              debugger;
            },
          };
        },
      },
    ],
  ],
}));

content = await format(content, {
  parser: "typescript",
  filepath: inputFile.name,
});

await Bun.write("out.js", content);

await saveCache();
