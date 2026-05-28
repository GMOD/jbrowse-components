import { displaysReady } from './runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'

// Build a minimal model shape — displaysReady only touches
// levels[].tracks[].displays[].{featureData,error}.
function makeModel(
  displaysPerTrack: { featureData?: unknown; error?: unknown }[][][],
) {
  return {
    levels: displaysPerTrack.map(tracks => ({
      tracks: tracks.map(displays => ({ displays })),
    })),
  } as unknown as LinearSyntenyViewModel
}

test('displaysReady is true when every display has featureData', () => {
  const m = makeModel([[[{ featureData: { foo: 1 } }, { featureData: {} }]]])
  expect(displaysReady(m)).toBe(true)
})

test('displaysReady is true when a display has an error', () => {
  // Error path counts as ready so a failed display doesn't deadlock init.
  const m = makeModel([[[{ error: new Error('nope') }]]])
  expect(displaysReady(m)).toBe(true)
})

test('displaysReady is false when any display lacks both', () => {
  const m = makeModel([[[{ featureData: {} }, {}]]])
  expect(displaysReady(m)).toBe(false)
})

test('displaysReady is true on an empty model (no levels)', () => {
  expect(displaysReady(makeModel([]))).toBe(true)
})
