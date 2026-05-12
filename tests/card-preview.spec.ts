/**
 * Test file demonstrating the use of @googleworkspace/card-dev-assist
 * to verify and render screenshots of Google Workspace card components.
 *
 * This helps ensure that the card UI in Cards.gs renders correctly.
 */

import { test, expect } from "@playwright/test";
import { previewCard } from "@googleworkspace/card-dev-assist";
import { writeFile } from "fs/promises";
import { join } from "path";

/**
 * Sample card object matching the structure created in Cards.gs
 * This represents the homepage card that users see in the Gmail add-on
 */
const homepageCard = {
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
};

/**
 * Sample card for the spreadsheet link display
 */
const spreadsheetLinkCard = {
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
};

test.describe("Google Workspace Card Rendering", () => {
  test("should generate screenshot of homepage card", async () => {
    // Generate a PNG screenshot of the homepage card
    const { screenshot, url } = await previewCard(homepageCard);

    // Verify we got valid base64 data
    expect(screenshot).toBeTruthy();
    expect(typeof screenshot).toBe("string");
    expect(url).toBeTruthy();

    // Save the screenshot to the test-results directory for inspection
    const outputPath = join(
      process.cwd(),
      "test-results",
      "homepage-card-preview.png",
    );
    const buffer = Buffer.from(screenshot, "base64");
    await writeFile(outputPath, buffer);

    console.log(`Homepage card screenshot saved to: ${outputPath}`);
    console.log(`Preview URL: ${url}`);
  });

  test("should generate screenshot of spreadsheet link card", async () => {
    // Generate a PNG screenshot of the spreadsheet link card
    const { screenshot, url } = await previewCard(spreadsheetLinkCard);

    // Verify we got valid base64 data
    expect(screenshot).toBeTruthy();
    expect(typeof screenshot).toBe("string");
    expect(url).toBeTruthy();

    // Save the screenshot to the test-results directory
    const outputPath = join(
      process.cwd(),
      "test-results",
      "spreadsheet-link-card-preview.png",
    );
    const buffer = Buffer.from(screenshot, "base64");
    await writeFile(outputPath, buffer);

    console.log(`Spreadsheet link card screenshot saved to: ${outputPath}`);
    console.log(`Preview URL: ${url}`);
  });

  test("should verify card has required components", async () => {
    // Verify homepage card structure
    expect(homepageCard.header).toBeDefined();
    expect(homepageCard.header.title).toBe("Email Classifier");
    expect(homepageCard.sections).toHaveLength(1);
    expect(homepageCard.sections[0].widgets).toBeDefined();

    // Verify button list exists
    const buttonList = homepageCard.sections[0].widgets[0].buttonList;
    expect(buttonList).toBeDefined();
    expect(buttonList.buttons).toHaveLength(2);

    // Verify button properties
    expect(buttonList.buttons[0].text).toBe("Classify emails");
    expect(buttonList.buttons[1].text).toBe("Create labels");
  });
});
