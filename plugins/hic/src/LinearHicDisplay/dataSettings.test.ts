import { getConf, setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core/chrome'

type StepperOpts = Parameters<typeof makeResolutionSubMenuItem>[0]

// the stepper is a custom row, so its callbacks are caught where the menu
// hands them over
const stepper: { opts?: StepperOpts } = {}
jest.mock('@jbrowse/wiggle-core/chrome', () => ({
  makeResolutionSubMenuItem: (opts: StepperOpts) => {
    stepper.opts = opts
    return { label: 'Resolution', subMenu: [] }
  },
}))

function flush() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

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
  const auto = display.binSizeIdx
  expect(auto).toBeGreaterThan(0)

  setConf(display, ['data', 'resolution'], 1)
  expect(display.binSizeIdx).toBe(auto - 1)
  setConf(display, ['data', 'resolution'], -1)
  expect(display.binSizeIdx).toBe(auto + 1)
})

test('the menu steps write data.resolution, and Normalization writes data.normalization', async () => {
  const display = await displayWithLadder()
  display.stepResolution(1)
  expect(getConf(display, ['data', 'resolution'])).toBe(1)
  display.setResolution(0)
  expect(getConf(display, ['data', 'resolution'])).toBe(0)

  display.setNormalization('VC')
  expect(getConf(display, ['data', 'normalization'])).toBe('VC')
  expect(display.activeNormalization).toBe('VC')
})

test("the stepper's Finer writes one step finer, Coarser one coarser, Reset 0", async () => {
  const display = await displayWithLadder()
  buildHicTrackMenuItems(display)
  stepper.opts!.onFiner()
  expect(display.resolution).toBe(1)
  stepper.opts!.onCoarser()
  stepper.opts!.onCoarser()
  expect(display.resolution).toBe(-1)
  stepper.opts!.onReset()
  expect(display.resolution).toBe(0)
})
