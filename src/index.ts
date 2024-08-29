import { format } from "prettier";
import putout from "putout";
import { getNewFunctionNameSync } from "./openai";

const inputFile = Bun.file("./src/test/dummy.js");
let content = await inputFile.text();

const renamed = new Set<string>();

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

              global.__idf = path;

              const isFunctionDeclaration =
                path.container.type === "FunctionDeclaration";

              console.debug(
                name,
                isFunctionDeclaration

                // bindings
              );
              if (isFunctionDeclaration) {
                if (path.container.end - path.container.start <= 500) {
                  const functionDeclarationText = content.slice(
                    path.container.start,
                    path.container.end
                  );

                  console.log("Asking for new function name", {
                    name,
                    functionDeclarationText,
                  });

                  const newFunctionName = getNewFunctionNameSync(
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
