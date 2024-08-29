import OpenAI from "openai";

export const openai = new OpenAI();

export async function getNewFunctionName(functionDeclaration: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a JavaScript developer. You have a function declaration that you want to rename, to make it more descriptive. What would you like to rename it to?",
      },
      {
        role: "user",
        content: functionDeclaration,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "functionName",
        schema: {
          type: "object",
          properties: {
            functionName: {
              type: "string",
            },
          },
        },
      },
    },
  });

  const content = response.choices?.[0].message.content;

  if (!content) {
    console.error(response);
    throw new Error("Failed to get new function name");
  }

  return JSON.parse(content).functionName as string;
}

export function getNewFunctionNameSync(functionDeclaration: string) {
  const proc = Bun.spawnSync({
    cmd: [process.execPath, "run", __filename, "--", functionDeclaration],
  });

  if (proc.success) {
    return proc.stdout.toString().trim();
  }

  throw new Error(
    `Failed to execute sync Bun process for getNewFunctionName (exit code ${proc.exitCode}):\n${proc.stderr.toString()}`
  );
}

if (import.meta.main) {
  const functionDeclaration = process.argv[2];

  if (!functionDeclaration || functionDeclaration.length < 5) {
    throw new Error("Invalid function declaration");
  }

  console.log(await getNewFunctionName(functionDeclaration));
}
