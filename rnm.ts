import putout from "putout";

await Bun.write(
  "out.js",
  putout(await Bun.file("./src/test/dummy.js").text(), {
    plugins: [
      [
        "rename",
        {
          report() {
            return "tsre rename";
          },

          fix({ path, names }) {
            const { name } = path.node;
            const to = names[name];

            path.scope.rename(name, to);
          },

          traverse({ push }) {
            const names = {
              y: "convertFtoC",
              z: "convertCtoF",
              A: "convertKtoC",
              B: "convertCtoK",
            };

            const namesKeys = Object.keys(names);

            return {
              Identifier(path) {
                const { name } = path.node;
                const bindings = path.scope.getAllBindings();

                if (namesKeys.includes(name) && bindings[name])
                  push({
                    path,
                    names,
                  });
              },
            };
          },
        },
      ],
    ],
  }).code
);
