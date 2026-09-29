import type { AstroIntegration } from "astro";
import { ensureFonts } from "../../scripts/fonts/subset-ui-font";

export function fontPreparation(prepare = ensureFonts): AstroIntegration {
  return {
    name: "notes-font-preparation",
    hooks: {
      "astro:config:setup": async ({ command, logger }) => {
        if (command === "preview") return;
        const start = performance.now();
        logger.info("Validating font sources and preparing subsets…");
        try {
          await prepare();
          logger.info(
            `Font preparation complete (${((performance.now() - start) / 1000).toFixed(2)}s).`,
          );
        } catch (error) {
          logger.error("Font preparation failed.");
          throw error;
        }
      },
    },
  };
}
