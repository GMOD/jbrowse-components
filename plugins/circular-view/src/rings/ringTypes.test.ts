import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun, when } from 'mobx'

import { RING_GAP_PX, ringAxisTicks } from './ringHost.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { RingDisplay } from './ringHost.ts'
import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const TWO_PI = 2 * Math.PI

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (!item || !('subMenu' in item)) {
    return []
  }
  return typeof item.subMenu === 'function' ? item.subMenu() : item.subMenu
}
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
  assemblies = ['volvox'],
) {
  const session = createTestSession()
  for (const name of assemblies) {
    session.addAssemblyConf({
      name,
      sequence: {
        trackId: `${name}_refseq`,
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
  }
  session.addSessionTrackConf({
    trackId: 'ring',
    name: 'ring',
    assemblyNames: ['volvox'],
    ...track,
  })
  const view = (await session.launchView('CircularView', {
    assembly: assemblies,
    tracks: [
      displayType
        ? { trackId: 'ring', displaySnapshot: { type: displayType } }
        : 'ring',
    ],
  })) as CircularViewModel
  view.setWidth(800)
  for (const name of assemblies) {
    await session.assemblyManager.waitForAssembly(name)
  }
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0] as RingDisplay & {
    host: unknown
    canvasWidthPx: number
    loadedRegions: ReadonlyMap<number, unknown>
    renderBlocks: { screenStartPx: number; screenEndPx: number }[]
    displayPhase: string
    error: unknown
    viewportWithinLoadedData: boolean
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

  // the ring is the display's height, under the ruler, shrunk to leave the
  // small test circle half its radius
  const [ring] = host.rings
  expect(ring!.outerPx).toBe(view.radiusPx - RING_GAP_PX)
  expect(ring!.innerPx).toBeCloseTo(
    ring!.outerPx - Math.min(display.height, view.radiusPx / 2 - RING_GAP_PX),
  )
  expect(host.chordRadiusPx).toBe(ring!.innerPx - RING_GAP_PX)

  // the strip fetched per slice
  await when(() => display.loadedRegions.size === 2)
  expect([...display.loadedRegions.keys()].sort()).toEqual([0, 1])

  // and its score axis, running from the ring's outer rim to its inner
  await when(() => ringAxisTicks(ring!).length > 0)
  const radii = ringAxisTicks(ring!).map(t => t.radius)
  expect(Math.max(...radii)).toBeLessThanOrEqual(ring!.outerPx + 0.5)
  expect(Math.min(...radii)).toBeGreaterThanOrEqual(ring!.innerPx - 0.5)
}, 30000)

// a ring has no label to hang its track menu off, so the view menu carries
// it, and the wiggle's own settings are reachable on the circle
// a gene density bigWig for one genome, opened on a circle of two: it draws on
// its genome's arcs and leaves the other's blank, where it used to fail the
// whole ring with an assembly mismatch
test("a single-genome track draws on its genome's arcs of a two-genome circle", async () => {
  const { view, display } = await ringTestSession(
    {
      type: 'QuantitativeTrack',
      adapter: {
        type: 'FromConfigAdapter',
        features: [
          ...scores('ctgA', CTG_A_BP, 100),
          ...scores('ctgB', CTG_B_BP, 100),
        ],
      },
    },
    undefined,
    ['volvox', 'volvox2'],
  )
  expect(view.assemblyNames).toEqual(['volvox', 'volvox2'])
  await when(() => display.loadedRegions.size === 2)
  expect([...display.loadedRegions.keys()].sort()).toEqual([0, 1])
  expect(display.error).toBeUndefined()
  // judged on its own genome's arcs, so the other genome's never hold it loading
  expect(display.viewportWithinLoadedData).toBe(true)
}, 30000)

test("a ring's track menu is under the view menu's Tracks item", async () => {
  const { view } = await wiggleSession()
  const [ring] = subMenuOf(view.menuItems(), 'Tracks')
  expect(ring && 'label' in ring ? ring.label : undefined).toBe('ring')
  expect(
    subMenuOf(ring ? [ring] : [], 'ring').map(item =>
      'label' in item ? item.label : undefined,
    ),
  ).toEqual(expect.arrayContaining(['Score']))
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

// the upload diffs cells by reference, so a cell that moved is a texture copy:
// one ring repainting must not re-copy its neighbour's strip
test("a ring repainting leaves the other ring's cell as it was", async () => {
  const { session, view, display } = await wiggleSession()
  session.addSessionTrackConf({
    trackId: 'ring2',
    name: 'ring2',
    type: 'QuantitativeTrack',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: scores('ctgA', CTG_A_BP, 100),
    },
  })
  await view.launchTrack('ring2')
  const host = view.ringHost
  const second = view.tracks[1]!.displays[0] as RingDisplay & {
    markCanvasDrawn: () => void
  }
  for (const d of [display, second]) {
    host.setStripElement(
      d.id,
      fakeStrip(Math.round(host.width), d.height).strip,
    )
  }
  const cells: (typeof host.ringCells)[] = []
  const dispose = autorun(() => {
    cells.push(host.ringCells)
  })
  await when(() => cells.at(-1)!.length === 2)
  const [first, other] = cells.at(-1)!

  second.markCanvasDrawn()

  const [firstAfter, otherAfter] = cells.at(-1)!
  expect(firstAfter).toBe(first)
  expect(otherAfter).not.toBe(other)
  expect(otherAfter!.strip?.image).toBe(other!.strip?.image)
  dispose()
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
              mark: 'bar',
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
              mark: 'bar',
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

test('an alignments track draws its own pileup and coverage as a ring, reading the strip as its view', async () => {
  const { view, display } = await ringTestSession({
    type: 'AlignmentsTrack',
    adapter: { type: 'FromConfigAdapter', features },
  })
  const host = view.ringHost
  expect(display.type).toBe('LinearAlignmentsDisplay')
  expect(display.host).toBe(host)
  // the display reads the linear genome view itself, and the strip answers
  // the members it draws by
  const lgv = (display as unknown as { view: unknown }).view
  expect(lgv).toBe(host)
  expect(host.bpToPx({ refName: 'ctgB', coord: 0 })).toEqual({
    index: 1,
    offsetPx: Math.round(host.visibleRegions[1]!.screenStartPx),
  })
  expect(host.bpToPx({ refName: 'ctgC', coord: 0 })).toBeUndefined()
  const back = host.pxToBp(host.visibleRegions[1]!.screenStartPx + 10)
  expect(back.refName).toBe('ctgB')
  expect(back.oob).toBe(false)
  expect(back.coord0).toBe(Math.floor(10 * host.bpPerPx))
  expect(host.pxToBp(host.visibleRegions[0]!.screenEndPx + 1).oob).toBe(true)
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
