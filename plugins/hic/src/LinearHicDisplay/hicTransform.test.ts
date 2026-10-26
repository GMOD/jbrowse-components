import {
  triangleDataToScreen,
  triangleScreenToData,
} from '@jbrowse/display-kit/triangleTransform'

import {
  INSTANCE_STRIDE_WORDS,
  setInstanceCount,
  setInstancePosition,
} from './components/shaders/hic.iface.generated.ts'
import { findContactAt } from './contactLookup.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { HicDataResult } from '../RenderHicDataRPC/types.ts'

const W = 4 // binWidth in pre-rotation px

const TRANSFORMS = [
  { viewScale: 1, viewOffsetX: 0, yScalar: 1, yOffsetPx: 0 },
  { viewScale: 1, viewOffsetX: 0, yScalar: 2, yOffsetPx: 0 },
  { viewScale: 0.25, viewOffsetX: -137, yScalar: 0.5, yOffsetPx: 40 },
  { viewScale: 3.5, viewOffsetX: 512, yScalar: 1.75, yOffsetPx: 0 },
]

describe('the forward and inverse view transforms agree', () => {
  test.each(TRANSFORMS)('round trips through %p', t => {
    for (const [ux, uy] of [
      [0, 0],
      [100, 100],
      [12.5, 990],
      [-40, 7],
    ]) {
      const { x, y } = triangleDataToScreen(ux!, uy!, t)
      const back = triangleScreenToData(x, y, t)
      expect(back.x).toBeCloseTo(ux!, 6)
      expect(back.y).toBeCloseTo(uy!, 6)
    }
  })
})

/**
 * Single region at data-x [0, span*W), `combinedOffset` 0, so contact `i`'s cell
 * origin is `(bin1*W, bin2*W)` — the worker's own position math
 * (`positions[i*2] = (bin + combinedOffset) * binWidth`) with the offset
 * dropped out.
 */
function makeData(contacts: { bin1: number; bin2: number }[], span: number) {
  const n = contacts.length
  const instances = new Float32Array(n * INSTANCE_STRIDE_WORDS)
  contacts.forEach(({ bin1, bin2 }, i) => {
    setInstancePosition(instances, i, bin1 * W, bin2 * W)
    // unique, so a hover identifies exactly one contact
    setInstanceCount(instances, i, i + 1)
  })
  return {
    instances,
    numContacts: n,
    maxScore: n,
    quantileScore: n,
    quantile: 0.95,
    binWidth: W,
    originBp: 0,
    binSize: 1000,
    appliedNormalizations: ['KR'],
    appliedField: 'observed',
    regions: [
      {
        refName: 'ctgA',
        dataXStart: 0,
        dataXEnd: span * W,
        combinedOffset: 0,
        reversed: false,
      },
    ],
    pairRuns: [{ region1Idx: 0, region2Idx: 0, start: 0, end: n }],
  } satisfies HicDataResult
}

// The end-to-end claim, and the one nothing checked: hover the pixel the
// renderer paints a contact at, and `hitTest` hands back that contact.
//
// `contactLookup.test.ts` covers the half below this — it starts from
// pre-rotation data coordinates, i.e. from `hitTest`'s output — and
// `svgExportGeometry.test.ts` covers the forward map. Between them sat
// `hitTest`'s inverse, whose only tie to the forward map was a comment. It reads
// the transform out of `renderState`, which is exactly what is uploaded to the
// backend, so a term dropped on either side shows up here.
const { createDisplay } = createTestEnvironment()

describe('hitTest inverts what the renderer drew', () => {
  test.each([
    ['natural height', false],
    ['fit-to-height squash', true],
  ])('%s', (_label, squash) => {
    const { display } = createDisplay()
    display.setHeightMode(squash ? 'fit' : 'fixed')
    // held here rather than read back off the payload: the packed buffer no
    // longer carries bin columns, and the point of this suite is that the bins
    // that went in come back out the far end of the transform
    const contacts = [
      { bin1: 2, bin2: 5 },
      { bin1: 7, bin2: 7 },
      { bin1: 0, bin2: 30 },
    ]
    display.setRpcData(makeData(contacts, 64))

    const { viewScale, viewOffsetX, yScalar } = display.renderState
    // squash actually engaged, or the second case is a copy of the first
    expect(squash ? yScalar !== 1 : yScalar === 1).toBe(true)

    contacts.forEach(({ bin1, bin2 }, i) => {
      // the cell's center in pre-rotation data space, forward-mapped to the
      // pixel the shader/Canvas2D path puts it on
      const { x, y } = triangleDataToScreen(
        bin1 * W + W / 2,
        bin2 * W + W / 2,
        {
          viewScale,
          viewOffsetX,
          yScalar,
          yOffsetPx: 0,
        },
      )
      expect(display.hitTest(x, y)).toEqual({
        index: i,
        bin1,
        bin2,
        region1Idx: 0,
        region2Idx: 0,
        value: i + 1,
      })
    })
  })
})

// The hover is resolved from where the pointer stands, so a frame that stops
// describing the data takes it away under a cursor that never moved.
test('the hover is the contact under the pointer, and none once the load is canceled', () => {
  const { display } = createDisplay()
  display.setRpcData(makeData([{ bin1: 2, bin2: 5 }], 64))
  const { viewScale, viewOffsetX, yScalar } = display.renderState
  display.setPointer(
    triangleDataToScreen(2 * W + W / 2, 5 * W + W / 2, {
      viewScale,
      viewOffsetX,
      yScalar,
      yOffsetPx: 0,
    }),
  )
  expect(display.hoveredFeature).toMatchObject({ bin1: 2, bin2: 5 })

  display.cancelFetchByUser()
  expect(display.hoveredFeature).toBeUndefined()
})

// The fixture is honest about the layer below: hovering the same cell centers in
// data space directly must find the same contacts, so a failure above is the
// transform and not the lookup.
test('the same cells resolve from data space', () => {
  const data = makeData([{ bin1: 2, bin2: 5 }], 64)
  expect(findContactAt(data, 2 * W + W / 2, 5 * W + W / 2)?.value).toBe(1)
})
