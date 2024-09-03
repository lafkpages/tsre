import type { ChatCompletionMessageParam } from "openai/resources/index";
import type { AIOptions } from "./common";

import OpenAI from "openai";

import { defaultAiOptions } from "./common";

export const openai = new OpenAI();

async function guessNewIdentifierNameAsync(
  usedBindings: string,
  identifierType: string,
  data: string,
  context?: string,
  opts?: AIOptions,
) {
  // prettier-ignore
  const options: Required<AIOptions> = {
   ...defaultAiOptions,
    ...opts,
  };

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a JavaScript deobfuscator. You have a ${identifierType} that you want to rename, to make it more descriptive. What would you like to rename it to?`,
    },
    {
      role: "system",
      content: `You must not use any of the following names as they are already used in the program: ${usedBindings}`,
    },
    {
      role: "system",
      content:
        "You may also provide additional context about the program to help the AI make better suggestions in the future.",
    },
  ];

  if (!options.supportsJsonSchema) {
    messages.push({
      role: "system",
      content:
        "Respond with a JSON object like { newName: string; additionalProgramContext?: string }",
    });
  }

  if (context) {
    messages.push({
      role: "user",
      content: `Program context:\n${context}`,
    });
  }

  messages.push({
    role: "user",
    content: data,
  });

  const response = await openai.chat.completions.create({
    model: options.model,
    messages,
    response_format: options.supportsJsonSchema
      ? {
          type: "json_schema",
          json_schema: {
            name: "identifierNameResult",
            schema: {
              type: "object",
              properties: {
                newName: {
                  type: "string",
                },
                additionalProgramContext: {
                  type: "string",
                },
              },
              required: ["newName"],
            },
          },
        }
      : {
          type: "json_object",
        },
  });

  const content = response.choices?.[0].message.content;

  if (!content) {
    console.error(response);
    throw new Error(`Failed to get new "${identifierType}" identifier name`);
  }

  return content;
}

if (import.meta.main) {
  const usedBindings = process.argv[2];
  const identifierType = process.argv[3];
  const data = process.argv[4];
  const context = process.argv[6];
  const opts = JSON.parse(process.argv[5]) as AIOptions;

  if (!identifierType || identifierType.length <= 1) {
    throw new Error("Invalid identifier type");
  }

  if (!data || data.length <= 2) {
    throw new Error("Invalid data");
  }

  console.log(
    await guessNewIdentifierNameAsync(
      usedBindings,
      identifierType,
      data,
      context,
      opts,
    ),
  );
}
