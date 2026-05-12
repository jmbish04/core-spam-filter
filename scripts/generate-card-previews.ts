/**
 * Utility script for generating card previews during development.
 * This helps verify that the Google Workspace card components render correctly.
 *
 * Usage:
 *   npx tsx scripts/generate-card-previews.ts
 */

import { previewCard } from "@googleworkspace/card-dev-assist";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Sample cards that match the structure in Cards.gs
 */
const cards = {
  homepage: {
    header: {
      title: "Email Classifier",
      imageUrl:
        "https://fonts.gstatic.com/s/i/googlematerialicons/label_important/v20/googblue-24dp/1x/gm_label_important_googblue_24dp.png",
      imageStyle: "CIRCLE",
    },
    sections: [
      {
        widgets: [
          {
            buttonList: {
              buttons: [
                {
                  text: "Classify emails",
                  onClick: {
                    action: {
                      function: "main",
                    },
                  },
                  color: {
                    red: 0,
                    green: 0.48,
                    blue: 1,
                  },
                },
                {
                  text: "Create labels",
                  onClick: {
                    action: {
                      function: "createLabels",
                    },
                  },
                  color: {
                    red: 0.2,
                    green: 0.66,
                    blue: 0.33,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  },

  spreadsheetLink: {
    header: {
      title: "Sheet generated!",
    },
    sections: [
      {
        widgets: [
          {
            textParagraph: {
              text: "Click to open the sheet:",
            },
          },
          {
            buttonList: {
              buttons: [
                {
                  text: "Open Sheet",
                  onClick: {
                    openLink: {
                      url: "https://docs.google.com/spreadsheets/d/example",
                      openAs: "FULL_SCREEN",
                      onClose: "NOTHING",
                    },
                  },
                },
                {
                  text: "Go Back",
                  onClick: {
                    action: {
                      function: "onHomepageTrigger",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  },

  notification: {
    sections: [
      {
        widgets: [
          {
            textParagraph: {
              text: "Labels created successfully!",
            },
          },
        ],
      },
    ],
  },
};

async function generatePreviews() {
  console.log("Generating card previews...\n");

  // Create output directory if it doesn't exist
  const outputDir = join(process.cwd(), "card-previews");
  await mkdir(outputDir, { recursive: true });

  // Generate screenshot for each card
  for (const [name, card] of Object.entries(cards)) {
    try {
      console.log(`Generating preview for ${name} card...`);
      const { screenshot, url } = await previewCard(card);

      // Save the screenshot
      const outputPath = join(outputDir, `${name}-card.png`);
      const buffer = Buffer.from(screenshot, "base64");
      await writeFile(outputPath, buffer);

      console.log(`✓ Saved to ${outputPath}`);
      console.log(`  Preview URL: ${url}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name} card:`, error);
    }
  }

  console.log("\n✓ All card previews generated successfully!");
  console.log(`\nPreview images saved in: ${outputDir}`);
}

// Run the preview generation
generatePreviews().catch((error) => {
  console.error("Error generating previews:", error);
  process.exit(1);
});
