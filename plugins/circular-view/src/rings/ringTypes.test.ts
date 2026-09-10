import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { RING_GAP_PX } from './ringHost.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { RingDisplay } from './ringHost.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const TWO_PI = 2 * Math.PI
const CTG_A_BP = 16000
const CTG_B_BP = 8000

/**
 * A two-contig assembly and one track, opened on a circular view as a ring.
 * The display is whichever the track's config names first, or the one the
 * caller asks for.
 */
async function ringTestSession(
  track: Record<string, unknown>,
  displayType?: string,
) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: CTG_A_BP,
            seq: 'a'.repeat(CTG_A_BP),
          },
          {
            refName: 'ctgB',
            uniqueId: 'ctgB',
            start: 0,
            end: CTG_B_BP,
            seq: 'a'.repeat(CTG_B_BP),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'ring',
    name: 'ring',
    assemblyNames: ['volvox'],
    ...track,
  })
  const view = (await session.launchView('CircularView', {
    assembly: 'volvox',
    tracks: [
      displayType
        ? { trackId: 'ring', displaySnapshot: { type: displayType } }
        : 'ring',
    ],
  })) as CircularViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0] as RingDisplay & {
    host: unknown
    canvasWidthPx: number
    loadedRegions: ReadonlyMap<number, unknown>
    renderBlocks: { screenStartPx: number; screenEndPx: number }[]
    displayPhase: string
    error: unknown
  }
  return { session, view, display }
}

/**
 * A strip element the way `RingStrips` mounts one: a wrapper holding a chrome
 * with a canvas of the strip's size, so `ringCells` finds a strip to sample.
 */
function fakeStrip(width: number, height: number) {
  const strip = document.createElement('div')
  const chrome = document.createElement('div')
  chrome.dataset.displayId = 'ring'
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  chrome.append(canvas)
  strip.append(chrome)
  return { strip, chrome, canvas }
}

function scores(refName: string, length: number, step: number) {
  const out = []
  for (let start = 0; start < length; start += step) {
    out.push({
      uniqueId: `${refName}-${start}`,
      refName,
      start,
      end: start + step,
      score: (start / step) % 7,
    })
  }
  return out
}

async function wiggleSession() {
  return ringTestSession({
    type: 'QuantitativeTrack',
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        ...scores('ctgA', CTG_A_BP, 100),
        ...scores('ctgB', CTG_B_BP, 100),
      ],
    },
  })
}

test('a bigwig-shaped track opens on the circle as a wiggle ring over the strip', async () => {
  const { view, display } = await wiggleSession()
  const host = view.ringHost
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.host).toBe(host)
  expect(host.rings.map(r => r.display)).toEqual([display])

  // the strip is the circumference, one block per slice at the slice's arc
  expect(display.canvasWidthPx).toBeCloseTo(view.circumferencePx)
  const slices = view.staticSlices
  expect(host.visibleRegions.map(r => r.refName)).toEqual(['ctgA', 'ctgB'])
  for (const [i, region] of host.visibleRegions.entries()) {
    const slice = slices[i]!
    expect(region.screenStartPx).toBeCloseTo(slice.startRadians * view.radiusPx)
    expect(region.screenEndPx).toBeCloseTo(slice.endRadians * view.radiusPx)
    expect(region.displayedRegionIndex).toBe(i)
  }
  const [a, b] = display.renderBlocks
  expect(b!.screenStartPx - a!.screenEndPx).toBeCloseTo(view.effectiveSpacingPx)

  // the ring is the display's height, under the ruler
  const [ring] = host.rings
  expect(ring!.outerPx).toBe(view.radiusPx - RING_GAP_PX)
  expect(ring!.innerPx).toBe(ring!.outerPx - display.height)
  expect(host.chordRadiusPx).toBe(ring!.innerPx - RING_GAP_PX)

  // the strip fetched per slice
  await when(() => display.loadedRegions.size === 2)
  expect([...display.loadedRegions.keys()].sort()).toEqual([0, 1])
}, 30000)

test('a point on the wiggle ring unwarps to the strip column of its base', async () => {
  const { view, display } = await wiggleSession()
  const host = view.ringHost
  const [ring] = host.rings
  const { strip, canvas } = fakeStrip(Math.round(host.width), display.height)
  host.setStripElement(display.id, strip)
  const [cell] = host.ringCells
  expect(cell!.strip?.image).toBe(canvas)
  expect(cell!.channels.outerPx[0]).toBe(ring!.outerPx)

  // ctgB's midpoint, at the ring's middle, in the screen frame
  const slice = view.staticSlices[1]!
  const angle = (slice.startRadians + slice.endRadians) / 2
  const r = (ring!.innerPx + ring!.outerPx) / 2
  const screen = angle + view.offsetRadians
  const hit = host.ringHit(r * Math.cos(screen), r * Math.sin(screen))!
  expect(hit.ring).toBe(ring)
  expect(hit.y).toBeCloseTo(display.height / 2)
  const region = host.visibleRegions.find(
    v => hit.x >= v.screenStartPx && hit.x <= v.screenEndPx,
  )!
  expect(region.refName).toBe('ctgB')
  const bp =
    region.start +
    ((hit.x - region.screenStartPx) /
      (region.screenEndPx - region.screenStartPx)) *
      (region.end - region.start)
  expect(bp).toBeCloseTo(CTG_B_BP / 2, 0)

  // a full turn later is the same column
  const again = host.ringHit(
    r * Math.cos(screen + TWO_PI),
    r * Math.sin(screen + TWO_PI),
  )!
  expect(again.x).toBeCloseTo(hit.x)
}, 30000)

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
