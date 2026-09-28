import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { MarkRamp } from '@jbrowse/render-core/marks'

// A backend uploads a ramp on its table's identity, so a region that widens an
// open domain under a declared middle moves the middle's uniform, not a table.
test('a diverging ramp widened by a region keeps its table and its middle', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: {
            field: 'score',
            scale: 'linear',
            range: ['blue', 'white', 'red'],
            domainMid: 0,
          },
        },
      },
    ],
  }).createDisplay()
  const region = (scores: number[]) =>
    workerResult(
      display,
      features(
        scores.map((score, i) => ({ start: i * 10, end: i * 10 + 5, score })),
      ),
    )
  display.setRpcData(0, region([-1, 2]), REGION)
  const before = display.paintScales[0] as MarkRamp
  display.setRpcData(1, region([-5, 20]), REGION)
  const after = display.paintScales[0] as MarkRamp
  expect(before.domain).toEqual([-1, 2])
  expect(after.domain).toEqual([-5, 20])
  expect(after.lut).toBe(before.lut)
  expect(after.mid).toBe(0)
})
