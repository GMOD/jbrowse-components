import { readConfObject, setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

// An unpainted bin is the page behind the matrix, so a ramp dark at its low
// end reads as noise across the sparse long-range half unless it is reversed.
test.each([
  ['magma', true],
  ['viridis', true],
  ['fall', false],
  ['juicebox', false],
  ['reds', false],
] as const)('a config naming %s reverses it: %s', (scheme, reversed) => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['encoding', 'color', 'scale', 'scheme'], scheme)
  expect(display.colorReverse).toBe(reversed)
})

test('a written reverse wins over the scheme', () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['encoding', 'color', 'scale', 'scheme'], 'viridis')
  setConf(display, ['encoding', 'color', 'scale', 'reverse'], false)
  expect(display.colorReverse).toBe(false)
})

test('picking a scheme from the menu leaves reverse to follow it', () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['encoding', 'color', 'scale', 'reverse'], false)
  display.setColorScheme('magma')
  expect(
    readConfObject(display.configuration, [
      'encoding',
      'color',
      'scale',
      'scheme',
    ]),
  ).toBe('magma')
  expect(
    readConfObject(display.configuration, [
      'encoding',
      'color',
      'scale',
      'reverse',
    ]),
  ).toBeUndefined()
  expect(display.colorReverse).toBe(true)
})
