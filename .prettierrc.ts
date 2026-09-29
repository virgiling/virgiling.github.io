import type { Config } from "prettier";
const astroOptions: Config & { astroCompressHTML: "jsx" } = { parser: "astro", astroCompressHTML: "jsx" };
export default {
  plugins: ["prettier-plugin-astro"],
  overrides: [
    {
      files: "*.astro",
      options: astroOptions,
    },
  ],
} satisfies Config;
