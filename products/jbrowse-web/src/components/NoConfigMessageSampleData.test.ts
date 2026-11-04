import { isSvChannelsActive } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/svChannelsPreset.ts'
import {
  demoSessions,
  sampleConfigs,
  syntenyConfigs,
  volvoxAlignmentsLinks,
  volvoxSvChannelsTrack,
} from './NoConfigMessageSampleData.ts'

// A raw `href` must be a query-string-only relative URL (start with `?`).
// Prefixing it with a path (e.g. `test_data/x/config.json?...`) makes the
// browser navigate to that path and serve the raw file instead of the app.
test.each([
  ['sampleConfigs', sampleConfigs],
  ['syntenyConfigs', syntenyConfigs],
  ['demoSessions', demoSessions],
  ['volvoxAlignmentsLinks', volvoxAlignmentsLinks],
])('%s hrefs are query-string-only', (_name, links) => {
  for (const { href } of links) {
    if (href) {
      expect(href.startsWith('?')).toBe(true)
    }
  }
})

test('the SV channels link is the menu preset', () => {
  expect(isSvChannelsActive(volvoxSvChannelsTrack)).toBe(true)
})
