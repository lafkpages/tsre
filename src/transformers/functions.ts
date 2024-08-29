import { isFunctionDeclaration } from "typescript";
import type { NodeTransformer } from ".";
import type { FunctionDeclaration } from "typescript";

export default [
  {
    accepts(node) {
      return (
        false &&
        isFunctionDeclaration(node) &&
        !!node.name &&
        node.getFullWidth() <= 500
      );
    },
    async transform(node: FunctionDeclaration) {
      // ask llm
      const llmResult = `// verifySignature
function verifySignature(signature) {
    try {
        let publicKeyBase64 = Buffer.concat([GYi, Buffer.from(signature, "base64")]).toString("base64");
        return uKe.default.createPublicKey(\`-----BEGIN PUBLIC KEY-----
\${publicKeyBase64}
-----END PUBLIC KEY-----\`);
    } catch {
        return null;
    }
}`;

      const newFunctionMatch = llmResult.match(
        /^\s*\/\/\s*(\w+?)\s*\n\s*(.+)/s
      );

      if (newFunctionMatch) {
        const newFunctionName = newFunctionMatch[1];
        const newFunctionDeclaration = newFunctionMatch[2];

        const symbolsToRename = new Map();
        symbolsToRename.set(node.name!.getText(), newFunctionName);

        return [
          symbolsToRename,
          [
            {
              span: {
                start: node.getStart(),
                length: node.getWidth(),
              },
              newText: newFunctionDeclaration,
            },
          ],
        ];
      }

      return [null, []];
    },
  },
] satisfies NodeTransformer[];
