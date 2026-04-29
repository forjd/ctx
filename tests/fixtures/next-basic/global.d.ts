declare namespace JSX {
  interface IntrinsicElements {
    section: { children?: unknown };
  }
}

declare module "react/jsx-runtime" {
  export const jsx: unknown;
  export const jsxs: unknown;
}
