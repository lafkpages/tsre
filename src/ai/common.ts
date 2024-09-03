import type { ChatModel } from "openai/resources/index";

export interface AIOptions {
  model?: (string & {}) | ChatModel;
  supportsJsonSchema?: boolean;
}

// prettier-ignore
export const defaultAiOptions: Required<AIOptions> = {
  model: "gpt-4o-mini",
  supportsJsonSchema: true,
};
