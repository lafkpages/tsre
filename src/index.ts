import { format } from "prettier";
import putout from "putout";
import { guessNewIdentifierName, saveCache } from "./ai";

const inputFile = Bun.file("./src/test/dummy.js");
let content = await inputFile.text();

const renamed = new Set<string>();

const maxFunctionLength = 500;

({ code: content } = putout(content, {
  plugins: [
    [
      "tsre",
      {
        report() {
          return "tsre";
        },

        fix({ path, newName }) {
          const { name } = path.node;
          path.scope.rename(name, newName);
        },

        traverse({ push }) {
          return {
            Identifier(path) {
              const { name } = path.node;
              if (!path.scope.hasBinding(name)) {
                return;
              }

              if (renamed.has(name)) {
                return;
              }

              console.log("Traversing identifier", name, path.container.type);

              if (path.container.type === "FunctionDeclaration") {
                if (
                  path.container.end - path.container.start <=
                  maxFunctionLength
                ) {
                  const functionDeclarationText = content.slice(
                    path.container.start,
                    path.container.end
                  );

                  console.log("Asking for new function name", {
                    name,
                    functionDeclarationText,
                  });

                  const newFunctionName = guessNewIdentifierName(
                    "function",
                    functionDeclarationText
                  );

                  console.log("Got new function name:", {
                    name,
                    newFunctionName,
                  });

                  push({
                    path,
                    newName: newFunctionName,
                  });
                  renamed.add(newFunctionName);
                } else {
                  console.log("Function declaration too long, skipping");
                }
              } else if (path.parent.type === "FunctionDeclaration") {
                if (path.listKey === "params") {
                  if (
                    path.parent.end - path.parent.start <=
                    maxFunctionLength
                  ) {
                    const functionDeclarationText = content.slice(
                      path.parent.start,
                      path.parent.end
                    );

                    console.log("Asking for new parameter name", {
                      name,
                      functionDeclarationText,
                    });

                    const newParameterName = guessNewIdentifierName(
                      "parameter",
                      `/* rename parameter "${name}" */\n${functionDeclarationText}`
                    );

                    console.log("Got new parameter name:", {
                      name,
                      newParameterName,
                    });

                    push({
                      path,
                      newName: newParameterName,
                    });
                    renamed.add(newParameterName);
                  } else {
                    console.log(
                      "Function declaration for parameter too long, skipping"
                    );
                  }
                }
              }
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
