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
import putout from "putout";

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
    aiResult: AIResult;
  }

  let programContext = options.programContext;

  ({ code: content } = putout(content, {
    plugins: [
      [
        "tsre",
        {
          report() {
            return "tsre";
          },

          fix({ path, aiResult }: PushData) {
            if (path.scope.hasBinding(aiResult.newName)) {
              consola.warn(
                `Scope already has binding for "${aiResult.newName}", skipping`,
              );
              return;
            }

            const { name } = path.node;
            path.scope.rename(name, aiResult.newName);
          },

          traverse({ push: _push }: { push: (data: PushData) => void }) {
            function push(data: PushData) {
              _push(data);

              let scopeRenamed = renamed.get(data.path.scope.uid);

              if (!scopeRenamed) {
                scopeRenamed = new Set();
                renamed.set(data.path.scope.uid, scopeRenamed);
              }

              scopeRenamed.add(data.aiResult.newName);

              if (
                programContext !== false &&
                data.aiResult.additionalProgramContext
              ) {
                programContext += data.aiResult.additionalProgramContext;
                programContext += "\n";
              }
            }

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

                function guessNewIdentifierName(
                  ...args: ParametersButFirst<typeof ai.guessNewIdentifierName>
                ) {
                  const bindings = Object.keys(path.scope.getAllBindings());
                  const result = ai.guessNewIdentifierName(bindings, ...args);

                  if (options.saveCacheOnAIGuess && !result.cacheHit) {
                    ai.cache?.save();
                  }

                  return result;
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

                    consola.debug("Asking for new function name", {
                      name,
                      functionDeclarationText,
                    });

                    const aiResult = guessNewIdentifierName(
                      "function",
                      functionDeclarationText,
                      programContext,
                    );

                    consola.debug("Got new function name:", {
                      name,
                      aiResult,
                    });

                    push({
                      path,
                      aiResult,
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

                      const aiResult = guessNewIdentifierName(
                        "parameter",
                        `/* rename parameter "${name}" */\n${functionDeclarationText}`,
                        programContext,
                      );

                      consola.debug("Got new parameter name:", {
                        name,
                        aiResult,
                      });

                      push({
                        path,
                        aiResult,
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

                      const aiResult = guessNewIdentifierName(
                        "variable",
                        declarationText,
                        programContext,
                      );

                      consola.debug("Got new variable name:", {
                        name,
                        aiResult,
                      });

                      push({
                        path,
                        aiResult,
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

                  const aiResult = guessNewIdentifierName(
                    "class",
                    classDeclarationText,
                    programContext,
                  );

                  consola.debug("Got new class name:", {
                    name,
                    aiResult,
                  });

                  push({
                    path,
                    aiResult,
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
