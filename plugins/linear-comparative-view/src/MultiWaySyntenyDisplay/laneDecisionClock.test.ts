import { SimpleFeature } from '@jbrowse/core/util'
import { when } from 'mobx'

import { decideLaneFrames } from './laneDecision.ts'
import { createDisplay } from './testEnv.ts'

jest.mock('./laneDecision.ts', () => {
  const actual = jest.requireActual('./laneDecision.ts')
  return { ...actual, decideLaneFrames: jest.fn(actual.decideLaneFrames) }
})

const decisions = () => jest.mocked(decideLaneFrames).mock.calls.length

// One alignment every 40 bp of the view's ctgA:0-1000, onto ctgB, so the lane
// has a frame wherever the view is.
async function settledDisplay(bpPerPx: number, offsetPx: number) {
  const display = createDisplay()
  const view = display.lgv
  view.setNewView(bpPerPx, offsetPx)
  view.settleCoarseBlocks()
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures(
    Array.from(
      { length: 24 },
      (_, i) =>
        new SimpleFeature({
          uniqueId: `r${i}`,
          refName: 'ctgA',
          start: i * 40,
          end: i * 40 + 30,
          strand: 1,
          mate: {
            assemblyName: 'volvox_random',
            refName: 'ctgB',
            start: i * 40,
            end: i * 40 + 30,
          },
        }),
    ),
  )
  await when(() => display.rowFrames.get('volvox_random') !== undefined, {
    timeout: 5000,
  })
  return display
}

// Each step below is synchronous, so the coarse blocks' 500 ms throttle cannot
// settle the view between them: every frame of the gesture is unsettled.
test('a zoom animation decides nothing until the view settles, and draws at the live zoom', async () => {
  const display = await settledDisplay(1.25, 0)
  const view = display.lgv
  const before = decisions()
  for (let i = 0; i < 10; i++) {
    view.zoomTo(view.bpPerPx * 0.9)
  }
  expect(decisions()).toBe(before)
  const decision = display.laneDecisions.get('volvox_random')!
  const frame = display.rowFrames.get('volvox_random')!
  expect(frame.max - frame.min).toBeCloseTo(
    decision.rung * display.visibleBpSpan,
  )
  view.settleCoarseBlocks()
  expect(decisions()).toBe(before + 1)
})

test('a zoom far from the left edge keeps the stack laid out where the view is', async () => {
  const display = await settledDisplay(0.1, 4000)
  const view = display.lgv
  const before = decisions()
  const offsetPx = view.offsetPx
  view.zoomTo(view.bpPerPx / 2)
  expect(view.offsetPx - offsetPx).toBeGreaterThan(display.canvasWidthPx)
  expect(decisions()).toBe(before)
  expect(Math.abs(display.dragOffsetPx)).toBeLessThanOrEqual(
    display.canvasWidthPx,
  )
})

test('a pan of more than a screen lays the stack out again and decides nothing', async () => {
  const display = await settledDisplay(0.1, 4000)
  const view = display.lgv
  const before = decisions()
  view.horizontalScroll(display.canvasWidthPx / 2)
  expect(display.dragOffsetPx).toBe(-display.canvasWidthPx / 2)
  expect(view.horizontalScroll(2 * display.canvasWidthPx)).toBe(
    2 * display.canvasWidthPx,
  )
  expect(Math.abs(display.dragOffsetPx)).toBeLessThanOrEqual(
    display.canvasWidthPx,
  )
  expect(decisions()).toBe(before)
})
