import { stackBands } from '@jbrowse/core/util/bandLayout'

import { mafValueScales } from './valueScales.ts'

import type { MafValueScaleInputs } from './valueScales.ts'

const bounds = { min: 0, max: 200 }

function inputs(
  active: { coverage: boolean; conservation: boolean },
  overrides: Partial<MafValueScaleInputs> = {},
): MafValueScaleInputs {
  return {
    topBands: stackBands(['coverage', 'conservation'], {
      coverage: { active: active.coverage, height: 60, bounds },
      conservation: { active: active.conservation, height: 40, bounds },
    }),
    coverageActive: active.coverage,
    coverageDomain: [0, 30],
    conservationActive: active.conservation,
    scaleType: 'linear',
    symlogConstant: 1,
    caption: 'Depth',
    rules: undefined,
    grid: false,
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
