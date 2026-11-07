import { getRoot, unprotect } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'

test('a host naming the features itself leaves no name or description in the rows, keeping the settings', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setShowNames(true)
  display.setShowDescriptions(true)
  expect(display.showLabels).toBe(true)

  unprotect(getRoot(display))
  Object.defineProperty(display.host, 'namesFeatures', { value: true })
  expect(display.showLabels).toBe(false)
  expect(display.effectiveShowDescriptions).toBe(false)
  expect(display.showNames).toBe(true)
  expect(display.showDescriptions).toBe(true)
})
