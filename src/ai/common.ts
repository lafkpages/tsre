import type { AICache } from ".";
import type { AIProcOptions } from "./proc";

export interface AIOptions extends AIProcOptions {
  cache?: AICache | null;
}

// prettier-ignore
export const defaultAiProcOptions: Required<AIProcOptions> = {
  model: "gpt-4o-mini",
  supportsJsonSchema: true,
};
