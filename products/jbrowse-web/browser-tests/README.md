# JBrowse Web Browser Tests

This directory contains Puppeteer-based browser tests that run against a real browser instead of jsdom.

## Prerequisites

1. Build jbrowse-web first:
   ```bash
   cd products/jbrowse-web
   yarn build
   ```

2. Install dependencies:
   ```bash
   cd browser-tests
   yarn install
   ```

## Running Tests

```bash
# Run tests in headless mode
yarn test

# Run tests with visible browser
yarn test:headed

# Run tests with visible browser and slow motion (useful for debugging)
yarn test:debug

# Update canvas snapshots
yarn test:update
```

## How It Works

1. The test runner starts an HTTP server that serves:
   - The built JBrowse application from `../build`
   - Test data files from `../test_data`

2. Puppeteer launches a real Chromium browser and navigates to the app

3. Tests interact with the app using Puppeteer's API to:
   - Find elements by test ID or text content
   - Click, type, and interact with the UI
   - Wait for elements to appear
   - Capture and compare canvas snapshots

## Canvas Snapshot Testing

The test runner supports visual regression testing for canvas elements:

```typescript
runner.test('my canvas test', async (page) => {
  // ... setup code to render canvas ...

  const result = await captureCanvasSnapshot(
    page,
    '[data-testid="my-canvas"]',  // CSS selector for canvas
    'my-snapshot-name',            // Name for the snapshot file
    { threshold: 0.01 }            // 1% pixel difference threshold
  )

  if (!result.passed) {
    throw new Error(result.message)
  }
})
```

Snapshots are stored in `__snapshots__/` directory. On first run, snapshots are created automatically. On subsequent runs, the current canvas is compared against the stored snapshot.

Use `yarn test:update` or `yarn test -u` to update snapshots when intentional visual changes are made.

## Adding Tests

Tests are defined in `runner.ts` using the `TestRunner` class:

```typescript
runner.describe('My Test Suite', () => {
  runner.test('my test name', async (page) => {
    await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`)

    // Find elements
    const element = await findByTestId(page, 'my-element')
    await element.click()

    // Wait for text
    await findByText(page, 'Expected text')
  })
})
```

## Available Helpers

- `findByTestId(page, testId, options)` - Find element by `data-testid` attribute
- `findByText(page, text, options)` - Find element containing text (string or RegExp)
- `clickByText(page, text, options)` - Find and click element by text
- `delay(ms)` - Wait for specified milliseconds
- `captureCanvasSnapshot(page, selector, name, options)` - Capture and compare canvas snapshot
