// Citation.js does not ship declarations. Keep the unvalidated input boundary explicit.
declare module "@citation-js/core" {
  export class Cite {
    constructor(
      input: string,
      options?: { generateGraph?: boolean; forceType?: "@biblatex/text" },
    );
    data: unknown[];
  }
}
declare module "@citation-js/plugin-bibtex";
