# Card Preview Network Requirements

## Important Note

The `@googleworkspace/card-dev-assist` library requires network access to Google's Card Builder service at `https://addons.gsuite.google.com` to generate card previews.

### In Local Development

When running the card preview tools locally, ensure:
1. You have internet connectivity
2. Access to `addons.gsuite.google.com` is not blocked by your firewall or network

### In CI/CD Environments

If you encounter `ERR_NAME_NOT_RESOLVED` errors in CI/CD, this is expected if the environment restricts external network access. You can:

1. **Skip card preview tests in CI**: Add conditional logic to skip these tests in restricted environments
2. **Use allowlists**: If your CI environment supports it, add `addons.gsuite.google.com` to the network allowlist
3. **Run locally only**: Use card previews during development and skip them in automated pipelines

### Example: Conditional Test Execution

```typescript
test.describe("Google Workspace Card Rendering", () => {
  // Skip if running in CI without network access
  test.skip(process.env.CI && !process.env.ENABLE_CARD_PREVIEWS,
    "Card preview requires network access to Google services");

  test("should generate screenshot of homepage card", async () => {
    const { screenshot, url } = await previewCard(homepageCard);
    // ... rest of test
  });
});
```

### Manual Preview URLs

The library generates Google Card Builder URLs that you can open in your browser to manually preview cards. These URLs are logged during test execution and can be used even when automated screenshot generation fails.

Example:
```
Preview URL: https://addons.gsuite.google.com/uikit/builder?card=H4sIAAAAAAAAA...
```

Simply copy and paste this URL into your browser to see the card preview.
