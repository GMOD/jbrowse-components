import { readConfObject } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

// An unpainted bin is the page behind the matrix, so a ramp dark at its low
// end reads as noise across the sparse long-range half unless it is reversed.
test.each([
  ['magma', true],
  ['viridis', true],
  ['fall', false],
  ['juicebox', false],
  ['reds', false],
] as const)('picking %s from the menu reverses it: %s', (scheme, reversed) => {
  const { display } = createTestEnvironment().createDisplay()
  display.setColorScheme(scheme)
  expect(readConfObject(display.configuration, ['color', 'scheme'])).toBe(
    scheme,
  )
  expect(readConfObject(display.configuration, ['color', 'reverse'])).toBe(
    reversed,
  )
})
