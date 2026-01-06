# JBrowse Web Browser Tests

This directory contains Puppeteer-based browser tests that run against a real
browser instead of jsdom.

## Prerequisites

Build jbrowse-web first:

```bash
cd products/jbrowse-web
pnpm build
```

## Running Tests

From `products/jbrowse-web`:

```bash
# Run tests in headless mode
pnpm test:browser

# Run tests with visible browser
pnpm test:browser:headed

# Update canvas snapshots
pnpm test:browser:update
```

Or run directly:

```bash
node --experimental-strip-types browser-tests/runner.ts
node --experimental-strip-types browser-tests/runner.ts --headed
node --experimental-strip-types browser-tests/runner.ts --headed --slow-mo=100
node --experimental-strip-types browser-tests/runner.ts --update-snapshots
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

## Screenshot Testing

The test runner supports visual regression testing using full page screenshots.
Snapshots are stored in `__snapshots__/` directory. On first run, snapshots are
created automatically. On subsequent runs, the current screenshot is compared
against the stored snapshot.

Use `--update-snapshots` or `-u` to update snapshots when intentional visual
changes are made.

## Adding Tests

Tests are defined in `runner.ts` using test suites:

```typescript
const testSuites: TestSuite[] = [
  {
    name: 'My Test Suite',
    tests: [
      {
        name: 'my test name',
        fn: async page => {
          await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`)
          const element = await findByTestId(page, 'my-element')
          await element.click()
          await findByText(page, 'Expected text')
        },
      },
    ],
  },
]
```

## Available Helpers

- `findByTestId(page, testId, timeout)` - Find element by `data-testid`
  attribute
- `findByText(page, text, timeout)` - Find element containing text (string or
  RegExp)
- `delay(ms)` - Wait for specified milliseconds
- `waitForLoadingToComplete(page, timeout)` - Wait for loading overlays to
  disappear
- `capturePageSnapshot(page, name)` - Capture and compare full page screenshot

## Auth Test Servers

This directory also contains test servers for HTTP Basic and OAuth
authentication testing.

### Running Auth Servers

```bash
# Start OAuth server (port 3030)
node --experimental-strip-types browser-tests/OAuthServer/app.ts

# Start HTTP Basic Auth server (port 3040)
node --experimental-strip-types browser-tests/HTTPBasicAuthServer/app.ts
```

### Testing Authentication

1. Start the OAuth and/or BasicAuth servers in separate terminals
2. Start jbrowse-web dev server
3. Visit http://localhost:3000/?config=test_data/volvox/config_auth.json
