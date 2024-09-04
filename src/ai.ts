import type { BunFile } from "bun";
import type {
  ChatCompletionMessageParam,
  ChatModel,
} from "openai/resources/index";

import { consola } from "consola";
import OpenAI from "openai";

type CacheData = Record<string, AIResult>;

export interface AIOptions {
  model?: (string & {}) | ChatModel;
  supportsJsonSchema?: boolean;
  cache?: AICache | null;
}

export const defaultAiOptions: Required<AIOptions> = {
  model: "gpt-4o-mini",
  supportsJsonSchema: true,
  cache: null,
};

export class AI {
  private openai = new OpenAI();

  model;
  supportsJsonSchema;

  cache;

  constructor(opts: AIOptions) {
    this.model = opts.model || defaultAiOptions.model;
    this.supportsJsonSchema =
      opts.supportsJsonSchema ?? defaultAiOptions.supportsJsonSchema;

    this.cache = opts.cache;
  }

  async guessNewIdentifierName(
    usedBindings: string[],
    identifierType: string,
    data: string,
    context: string | false,
  ): Promise<AIGuess> {
    let cacheHash: number;
    if (this.cache) {
      cacheHash = getCacheHash(identifierType, data, context || "");
      const cached = this.cache.cacheData.get(cacheHash);

      if (cached) {
        return {
          ...cached,
          additionalProgramContext:
            context === false ? null : cached.additionalProgramContext,
          cacheHit: true,
        };
      }
    }

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a JavaScript deobfuscator. You have a ${identifierType} that you want to rename, to make it more descriptive. What would you like to rename it to?`,
      },
      {
        role: "system",
        content: `You must not use any of the following names as they are already used in the program: ${usedBindings}`,
      },
    ];

    if (context !== false) {
      messages.push({
        role: "system",
        content:
          "You may also provide additional context about the program to help the AI make better suggestions in the future.",
      });
    }

    if (!this.supportsJsonSchema) {
      messages.push({
        role: "system",
        content: `Respond with a JSON object like { newName: string${context === false ? "" : "; additionalProgramContext?: string"} }`,
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

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      response_format: this.supportsJsonSchema
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
                  additionalProgramContext:
                    context === false
                      ? undefined
                      : {
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

    const result = JSON.parse(content) as AIResult;

    if (this.cache) {
      this.cache.cacheData.set(cacheHash!, result);
    }

    return {
      ...result,
      cacheHit: false,
    };
  }
}

export class AICache {
  cacheData = new Map<number, AIResult>();
  private cacheFile;

  constructor(cacheFile: BunFile) {
    this.cacheFile = cacheFile;
  }

  async load() {
    const cacheData = (await this.cacheFile.json()) as CacheData;

    for (const [key, value] of Object.entries(cacheData)) {
      this.cacheData.set(parseInt(key), value);
    }
  }

  async save() {
    consola.debug("Saving AI cache");

    const cacheData: CacheData = {};

    for (const [key, value] of this.cacheData) {
      cacheData[key] = value;
    }

    await Bun.write(this.cacheFile, JSON.stringify(cacheData));
  }
}

export interface AIResult {
  newName: string;
  additionalProgramContext?: string | null;
}

export interface AIGuess extends AIResult {
  cacheHit: boolean;
}

function getCacheHash(identifierType: string, data: string, context: string) {
  return Bun.hash.adler32(`${identifierType}:${data}:${context}`);
}
