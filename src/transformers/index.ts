import type { Node, TextChange } from "typescript";
import type { MaybePromise } from "../types/helpers";
import functionTransformers from "./functions";

export type SymbolsRenameMap = Map<string, string>;

export interface NodeTransformer {
  accepts(node: Node): boolean;
  transform(node: Node): MaybePromise<[SymbolsRenameMap | null, TextChange[]]>;
}

export const transformers: NodeTransformer[] = [...functionTransformers];
