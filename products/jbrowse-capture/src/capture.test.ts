import { launchBrowser } from './browser.ts'
import { captureJBrowse } from './capture.ts'

import type { Annotation } from './annotationOverlay.ts'

jest.mock('./browser.ts', () => ({
  isBrowserConsoleNoise: () => false,
  launchBrowser: jest.fn(() => Promise.reject(new Error('browser launched'))),
}))

test('a callout the overlay could not draw fails before a browser launches', async () => {
  await expect(
    captureJBrowse({
      annotations: [{ type: 'squiggle' } as unknown as Annotation],
    }),
  ).rejects.toThrow('annotation 0: type "squiggle" is not one of')
  expect(launchBrowser).not.toHaveBeenCalled()
})
