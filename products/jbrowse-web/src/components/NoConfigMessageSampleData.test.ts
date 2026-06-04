import {
  demoSessions,
  galleryDemos,
  recentConfigs,
  sampleConfigs,
  syntenyConfigs,
} from './NoConfigMessageSampleData.ts'

// A raw `href` must be a query-string-only relative URL (start with `?`).
// Prefixing it with a path (e.g. `test_data/x/config.json?...`) makes the
// browser navigate to that path and serve the raw file instead of the app.
test.each([
  ['sampleConfigs', sampleConfigs],
  ['recentConfigs', recentConfigs],
  ['syntenyConfigs', syntenyConfigs],
  ['demoSessions', demoSessions],
  ['galleryDemos', galleryDemos],
])('%s hrefs are query-string-only', (_name, links) => {
  for (const { href } of links) {
    if (href) {
      expect(href.startsWith('?')).toBe(true)
    }
  }
})
