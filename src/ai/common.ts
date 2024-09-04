import type { AICache } from ".";
import type { AIProcOptions } from "./proc";

export interface AIOptions extends AIProcOptions {
  cache?: AICache | null;
}

export const defaultAiProcOptions: Required<AIProcOptions> = {
  model: "gpt-4o-mini",
  supportsJsonSchema: true,
};
