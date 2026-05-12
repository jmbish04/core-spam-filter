# Google Workspace Card Preview Utility

This project uses the `@googleworkspace/card-dev-assist` library to help verify that Google Workspace card components render correctly for our Gmail add-on.

## Overview

The `@googleworkspace/card-dev-assist` library allows us to generate PNG screenshots of card components, making it easier to:
- Develop and test Google Workspace Add-ons
- Ensure visual consistency and correctness of UI components
- Verify card rendering before deployment

## Installation

The library is already installed as a dependency:

```bash
npm install @googleworkspace/card-dev-assist
```

## Usage

### Quick Preview Generation

Generate previews of all card designs:

```bash
npm run card-previews
```

This will create PNG screenshots in the `card-previews/` directory for:
- Homepage card
- Spreadsheet link card
- Notification card

### Running Tests

The library is integrated with Playwright tests:

```bash
npm test
```

This will generate card screenshots in the `test-results/` directory during test execution.

### Manual Usage in Code

Import and use the library in your code:

```typescript
import { getScreenshot } from "@googleworkspace/card-dev-assist";

const card = {
  header: {
    title: "Email Classifier",
    imageUrl: "https://example.com/icon.png",
    imageStyle: "CIRCLE",
  },
  sections: [
    {
      widgets: [
        {
          textParagraph: {
            text: "Hello, world!",
          },
        },
      ],
    },
  ],
};

// Generate a base64-encoded PNG screenshot
const base64Data = await getScreenshot(card);

// Save or use the screenshot
const buffer = Buffer.from(base64Data, "base64");
await fs.writeFile("card-preview.png", buffer);
```

## Card Structure

The card objects should follow the Google Workspace card JSON structure. The library supports:

- **Headers**: Title, subtitle, image
- **Sections**: Groups of widgets
- **Widgets**: Text paragraphs, buttons, images, forms, etc.
- **Actions**: onClick handlers, navigation, links

## Files

- `scripts/generate-card-previews.ts` - Script to generate preview images for all cards
- `tests/card-preview.spec.ts` - Playwright tests with card preview generation
- `appscript/Cards.gs` - Google Apps Script card definitions (source of truth)
- `appscript/Labels.gs` - Label management for email classification

## Google Apps Script Integration

The Apps Script code in `appscript/` contains the actual card implementations that run in Gmail:

- `Cards.gs` - Card UI definitions for the Gmail add-on
- `Labels.gs` - Label creation and management
- `Code.js` - Main add-on logic
- `Utils.js` - Utility functions
- `Addon.js` - Add-on configuration

The preview generator creates equivalent card structures in JSON format to match what the Apps Script code produces.

## Deployment

Deploy the Apps Script add-on:

```bash
npm run deploy:appscript
```

This will deploy to both Gmail and Colby workspace accounts as configured in `.clasp.json`.

## Learn More

- [@googleworkspace/card-dev-assist on npm](https://www.npmjs.com/package/@googleworkspace/card-dev-assist)
- [Google Workspace Add-ons Documentation](https://developers.google.com/workspace/add-ons)
- [Card Service Reference](https://developers.google.com/apps-script/reference/card-service)
