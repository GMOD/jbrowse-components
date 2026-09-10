import { when } from 'mobx'

import { RING_GAP_PX } from './ringHost.ts'
import { CTG_A_BP, CTG_B_BP, ringTestSession } from './ringTestSession.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function spans(refName: string, length: number, step: number, width: number) {
  const out = []
  for (let start = 0; start + width <= length; start += step) {
    out.push({
      uniqueId: `${refName}-${start}`,
      refName,
      start,
      end: start + width,
    })
  }
  return out
}

const features = [
  ...spans('ctgA', CTG_A_BP, 50, 120),
  ...spans('ctgB', CTG_B_BP, 200, 120),
]

test('a density ring: a BED binned and counted by the mark display, over the strip', async () => {
  const { view, display } = await ringTestSession(
    {
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features },
      displays: [
        {
          type: 'LinearMarkDisplay',
          displayId: 'ring-LinearMarkDisplay',
          height: 40,
          marks: [
            {
              shape: 'bar',
              transform: [
                { type: 'bin', step: 1000 },
                {
                  type: 'aggregate',
                  groupby: ['start', 'end'],
                  ops: [{ op: 'count' }],
                },
              ],
              encoding: { y: 'count' },
            },
          ],
        },
      ],
    },
    'LinearMarkDisplay',
  )
  const host = view.ringHost
  expect(display.type).toBe('LinearMarkDisplay')
  expect(display.host).toBe(host)
  expect(display.canvasWidthPx).toBeCloseTo(view.circumferencePx)
  expect(display.height).toBe(40)

  const [ring] = host.rings
  expect(ring!.outerPx).toBe(view.radiusPx - RING_GAP_PX)
  expect(ring!.innerPx).toBe(ring!.outerPx - 40)

  const slices = view.staticSlices
  expect(display.renderBlocks.map(b => b.screenStartPx)).toEqual(
    slices.map(s => s.startRadians * view.radiusPx),
  )

  await when(() => display.loadedRegions.size === 2, { timeout: 20000 })
  expect(display.error).toBeUndefined()
}, 30000)

test('a coverage ring: an alignment-shaped track through the mark display coverage step', async () => {
  const { view, display } = await ringTestSession(
    {
      type: 'AlignmentsTrack',
      adapter: { type: 'FromConfigAdapter', features },
      displays: [
        {
          type: 'LinearMarkDisplay',
          displayId: 'ring-LinearMarkDisplay',
          height: 30,
          marks: [
            {
              shape: 'bar',
              transform: [{ type: 'coverage' }],
              encoding: { y: 'coverage' },
            },
          ],
        },
      ],
    },
    'LinearMarkDisplay',
  )
  const host = view.ringHost
  expect(display.type).toBe('LinearMarkDisplay')
  expect(display.host).toBe(host)
  expect(host.rings).toHaveLength(1)
  expect(host.rings[0]!.innerPx).toBe(view.radiusPx - RING_GAP_PX - 30)
  expect(host.width).toBeCloseTo(view.circumferencePx)

  await when(() => display.loadedRegions.size === 2, { timeout: 20000 })
  expect(display.error).toBeUndefined()
}, 30000)

test('a variant track keeps its chords: the view prefers its own display over an inherited one', async () => {
  const { view, display } = await ringTestSession({
    type: 'VariantTrack',
    displays: [
      { type: 'LinearVariantDisplay', displayId: 'ring-LinearVariantDisplay' },
      { type: 'ChordVariantDisplay', displayId: 'ring-ChordVariantDisplay' },
    ],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'sv1',
          refName: 'ctgA',
          start: 100,
          end: 200,
          mate: { refName: 'ctgB', start: 1000, end: 1100 },
        },
      ],
    },
  })
  expect(display.type).toBe('ChordVariantDisplay')
  expect(view.ringHost.rings).toHaveLength(0)
  expect(view.chordRadiusPx).toBe(view.radiusPx)
}, 30000)
