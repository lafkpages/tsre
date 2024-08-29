export type ParametersButFirst<T extends (...args: any) => any> = T extends (
  _: any,
  ...args: infer P
) => any
  ? P
  : never;
