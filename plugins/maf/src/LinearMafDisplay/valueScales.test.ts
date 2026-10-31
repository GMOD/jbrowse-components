import { mafTopBands } from './mafTopBands.ts'
import { mafValueScales } from './valueScales.ts'

import type { MafValueScaleInputs } from './valueScales.ts'

function inputs(
  active: { coverage: boolean; conservation: boolean },
  overrides: Partial<MafValueScaleInputs> = {},
): MafValueScaleInputs {
  return {
    topBands: mafTopBands(
      {
        coverage: { active: active.coverage, height: 60 },
        conservation: { active: active.conservation, height: 40 },
      },
      { height: 220, floor: 20 },
    ),
    coverageDomain: [0, 30],
    scaleType: 'linear',
    symlogConstant: 1,
    guide: { caption: 'Depth', grid: false, showAxis: true },
    ...overrides,
  }
}

test('coverage scales over its depth, conservation over a fixed 0-100', () => {
  const [coverage, conservation] = mafValueScales(
    inputs({ coverage: true, conservation: true }),
  )
  expect(coverage).toMatchObject({
    domain: [0, 30],
    scaleType: 'linear',
    height: 60,
    caption: 'Depth',
    bandTops: [0],
  })
  expect(conservation).toMatchObject({
    domain: [0, 100],
    scaleType: 'linear',
    height: 40,
    bandTops: [60],
  })
})

test('a band the display is not drawing contributes no scale', () => {
  expect(
    mafValueScales(inputs({ coverage: false, conservation: true })),
  ).toHaveLength(1)
  expect(
    mafValueScales(inputs({ coverage: true, conservation: false })),
  ).toHaveLength(1)
})

test('coverage waits for its depth domain', () => {
  expect(
    mafValueScales(
      inputs(
        { coverage: true, conservation: false },
        { coverageDomain: undefined },
      ),
    ),
  ).toEqual([])
})
