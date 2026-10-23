import { getConf, readConfObject, setConf } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'
import { createTestEnvironment } from './testEnv.ts'

function flush() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

const make = (snap: Record<string, unknown>) =>
  configSchemaFactory().create({
    type: 'LinearHicDisplay',
    displayId: 'hic-test',
    ...snap,
  })

test('the old resolutionBias and selectedNormalization lift under data, the bias flipped', () => {
  const conf = make({ resolutionBias: 2, selectedNormalization: 'VC' })
  expect(readConfObject(conf, ['data', 'resolution'])).toBe(-2)
  expect(readConfObject(conf, ['data', 'normalization'])).toBe('VC')
})

async function displayWithLadder() {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  mockRpcCall.mockResolvedValue({
    norms: ['KR', 'VC'],
    resolutions: [1, 10, 100, 1000, 10_000, 100_000, 1_000_000],
  })
  const { display, view } = createDisplay()
  view.setNewView(5000, 0)
  await flush()
  return display
}

test('a positive data.resolution is finer than the zoom picks, a negative coarser', async () => {
  const display = await displayWithLadder()
  const auto = display.effectiveResolutionIdx
  expect(auto).toBeGreaterThan(0)

  setConf(display, ['data', 'resolution'], 1)
  expect(display.effectiveResolutionIdx).toBe(auto - 1)
  setConf(display, ['data', 'resolution'], -1)
  expect(display.effectiveResolutionIdx).toBe(auto + 1)
})

test('the menu steps write data.resolution, and Normalization writes data.normalization', async () => {
  const display = await displayWithLadder()
  display.stepResolution(-1)
  expect(getConf(display, ['data', 'resolution'])).toBe(1)
  display.resetResolution()
  expect(getConf(display, ['data', 'resolution'])).toBe(0)

  display.setSelectedNormalization('VC')
  expect(getConf(display, ['data', 'normalization'])).toBe('VC')
  expect(display.activeNormalization).toBe('VC')
})
