import { offscreenMateStubs } from './offscreenMateStubs.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

function mates(n: number): OffscreenMateData {
  return {
    mateRefNameDict: ['other'],
    counts: Uint32Array.from([n]),
    starts: Float64Array.from({ length: n }, (_, i) => i * 100),
    ends: Float64Array.from({ length: n }, (_, i) => i * 100 + 50),
    mateRefNameIds: new Uint32Array(n),
  }
}

const QUERY_ROW = { bpPerPx: 2, offsetPx: 10 }
const TARGET_ROW = { bpPerPx: 99, offsetPx: 999 }

function source(over: Record<string, unknown> = {}) {
  return {
    level: 0,
    linearSyntenyDisplays: [{ featureData: { offscreenMates: mates(3) } }],
    parentView: {
      showOffscreenMates: true,
      views: [QUERY_ROW, TARGET_ROW],
    },
    ...over,
  }
}

// The one mistake here that draws something plausible instead of nothing: these
// have no position on the row below, so measuring them against its ruler puts
// every stub at a believable wrong offset.
test('stubs are measured against the query row, not the row below', () => {
  const [stub] = offscreenMateStubs(source())
  expect(stub).toMatchObject({ bpPerPx: 2, offsetPx: 10 })
})

test('an interior level reads its own upper row', () => {
  const [stub] = offscreenMateStubs(
    source({
      level: 1,
      parentView: {
        showOffscreenMates: true,
        views: [{ bpPerPx: 1, offsetPx: 1 }, QUERY_ROW, TARGET_ROW],
      },
    }),
  )
  expect(stub).toMatchObject({ bpPerPx: 2, offsetPx: 10 })
})

test('the toggle off draws nothing', () => {
  expect(
    offscreenMateStubs(
      source({
        parentView: {
          showOffscreenMates: false,
          views: [QUERY_ROW, TARGET_ROW],
        },
      }),
    ),
  ).toEqual([])
})

test('a display that has not fetched contributes nothing', () => {
  expect(offscreenMateStubs(source({ linearSyntenyDisplays: [{}] }))).toEqual(
    [],
  )
})

test('a display with nothing hidden contributes nothing to draw', () => {
  expect(
    offscreenMateStubs(
      source({
        linearSyntenyDisplays: [{ featureData: { offscreenMates: mates(0) } }],
      }),
    ),
  ).toEqual([])
})

test('every display on the level is drawn, not just the first', () => {
  expect(
    offscreenMateStubs(
      source({
        linearSyntenyDisplays: [
          { featureData: { offscreenMates: mates(3) } },
          { featureData: { offscreenMates: mates(2) } },
        ],
      }),
    ),
  ).toHaveLength(2)
})

test('a level whose row is gone draws nothing rather than throwing', () => {
  expect(
    offscreenMateStubs(
      source({
        parentView: { showOffscreenMates: true, views: [] },
      }),
    ),
  ).toEqual([])
})
