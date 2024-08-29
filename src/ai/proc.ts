import OpenAI from "openai";

export const openai = new OpenAI();

async function guessNewIdentifierNameAsync(
  identifierType: string,
  context: string,
) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a JavaScript developer. You have a ${identifierType} that you want to rename, to make it more descriptive. What would you like to rename it to?`,
      },
      {
        role: "user",
        content: context,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "identifierName",
        schema: {
          type: "object",
          properties: {
            newName: {
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
    throw new Error(`Failed to get new "${identifierType}" identifier name`);
  }

  return JSON.parse(content).newName as string;
}

if (import.meta.main) {
  const identifierType = process.argv[2];
  const context = process.argv[3];

  if (!identifierType || identifierType.length <= 1) {
    throw new Error("Invalid identifier type");
  }

  if (!context || context.length <= 2) {
    throw new Error("Invalid context");
  }

  console.log(await guessNewIdentifierNameAsync(identifierType, context));
}
