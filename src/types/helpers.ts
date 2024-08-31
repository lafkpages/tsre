type Wrap<T> = { [K in keyof T]-?: [T[K]] };
type Unwrap<T> = {
  [K in keyof T]: // prettier-ignore
  Extract<T[K], [any]>[0];
};

export type ParametersButFirstAndLast<F extends (...args: any) => any> =
  // prettier-ignore
  Wrap<Parameters<F>> extends [
  any,
  ...infer InitPs,
  any,
]
  ? // prettier-ignore
    Unwrap<InitPs>
  : never;
