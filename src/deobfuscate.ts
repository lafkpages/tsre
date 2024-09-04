import type { NodePath } from "@babel/traverse";
import type { Identifier, VariableDeclarator } from "@babel/types";
import type { AI, AIResult } from "./ai";
import type { ParametersButFirst } from "./types/helpers";

import {
  isArrayPattern,
  isClassDeclaration,
  isForOfStatement,
  isFunctionDeclaration,
  isVariableDeclaration,
  isVariableDeclarator,
} from "@babel/types";
import { consola } from "consola";
import { format } from "prettier";
// @ts-expect-error
import { putoutAsync } from "putout";

export interface DeobfuscateOptions {
  maxFunctionLength?: number;

  programContext?: string | false;

  saveCacheOnAIGuess?: boolean;
}

export async function deobfuscate(
  content: string,
  ai: AI,
  opts?: DeobfuscateOptions,
) {
  const options: Required<DeobfuscateOptions> = {
    maxFunctionLength: 500,

    programContext: "",

    saveCacheOnAIGuess: true,

    ...opts,
  };

  const renamed = new Map<number, Set<string>>();

  interface PushData {
    path: NodePath<Identifier>;
    identifierType: string;
    data: string;
  }

  let programContext = options.programContext;

  ({ code: content } = await putoutAsync(content, {
    plugins: [
      [
        "tsre",
        {
          report() {
            return "tsre";
          },

          async fix({ path, identifierType, data }: PushData) {
            const { name } = path.node;

            consola.debug("Guessing new identifier name:", {
              name,
              identifierType,
              data,
            });

            const aiResult = await ai.guessNewIdentifierName(
              Object.keys(path.scope.getAllBindings()),
              identifierType,
              data,
              programContext,
            );

            if (options.saveCacheOnAIGuess && !aiResult.cacheHit) {
              ai.cache?.save();
            }

            if (path.scope.hasBinding(aiResult.newName)) {
              consola.warn(
                `Scope already has binding for "${aiResult.newName}", skipping`,
              );
              return;
            }

            consola.debug("Renaming identifier:", {
              oldName: name,
              newName: aiResult.newName,
            });

            path.scope.rename(name, aiResult.newName);

            let scopeRenamed = renamed.get(path.scope.uid);

            if (!scopeRenamed) {
              scopeRenamed = new Set();
              renamed.set(path.scope.uid, scopeRenamed);
            }

            scopeRenamed.add(aiResult.newName);

            if (programContext !== false && aiResult.additionalProgramContext) {
              consola.debug(
                "Adding additional program context:",
                aiResult.additionalProgramContext,
              );

              programContext += aiResult.additionalProgramContext;
              programContext += "\n";
            }
          },

          traverse({ push }: { push: (data: PushData) => void }) {
            return {
              Identifier(path: NodePath<Identifier>) {
                const { name } = path.node;
                if (!path.scope.hasBinding(name)) {
                  return;
                }

                const scopeRenamed = renamed.get(path.scope.uid);

                if (scopeRenamed?.has(name)) {
                  return;
                }

                consola.debug("Traversing identifier:", name);

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
                    options.maxFunctionLength
                  ) {
                    const functionDeclarationText = content.slice(
                      container.start,
                      container.end,
                    );

                    push({
                      path,
                      identifierType: "function",
                      data: functionDeclarationText,
                    });
                  } else {
                    consola.warn("Function declaration too long, skipping");
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
                      options.maxFunctionLength
                    ) {
                      const functionDeclarationText = content.slice(
                        path.parent.start,
                        path.parent.end,
                      );

                      consola.debug("Asking for new parameter name", {
                        name,
                        functionDeclarationText,
                      });

                      push({
                        path,
                        identifierType: "parameter",
                        data: `/* rename parameter "${name}" */\n${functionDeclarationText}`,
                      });
                    } else {
                      consola.warn(
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

                  const declarator = isArrayDeclarator
                    ? (path.parentPath.parent as VariableDeclarator)
                    : isBaseDeclarator
                      ? (path.parent as VariableDeclarator)
                      : null;
                  const declaratorPath = isArrayDeclarator
                    ? (path.parentPath
                        .parentPath as NodePath<VariableDeclarator>)
                    : isBaseDeclarator
                      ? (path.parentPath as NodePath<VariableDeclarator>)
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

                      consola.debug("Asking for new variable name", {
                        name,
                        declarationText,
                      });

                      push({
                        path,
                        identifierType: "variable",
                        data: declarationText,
                      });
                    } else {
                      consola.warn("Variable declaration type not supported");
                    }

                    return;
                  }
                }

                if (
                  isClassDeclaration(path.parent) &&
                  typeof path.parent.start === "number" &&
                  path.parent.end
                ) {
                  const classDeclarationText = content.slice(
                    path.parent.start,
                    path.parent.end,
                  );

                  consola.debug("Asking for new class name", {
                    name,
                    classDeclarationText,
                  });

                  push({
                    path,
                    identifierType: "class",
                    data: classDeclarationText,
                  });

                  return;
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
  });

  return { content, programContext };
}
