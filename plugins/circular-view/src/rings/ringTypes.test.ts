import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
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
 * A two-contig assembly and one track, opened on a circular view: as the
 * circle's own display where the track type has one, else the linear display
 * its config names first, or the one the caller asks for. `fromCatalog` puts
 * the track in config.json's frozen list rather than the session's.
 */
async function ringTestSession(
  track: Record<string, unknown>,
  displayType?: string,
  assemblies = ['volvox'],
  fromCatalog = false,
) {
  const ring = { trackId: 'ring', name: 'ring', assemblyNames: ['volvox'] }
  const session = createTestSession(
    fromCatalog ? { jbrowseConfig: { tracks: [{ ...ring, ...track }] } } : {},
  )
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
  if (!fromCatalog) {
    session.addSessionTrackConf({ ...ring, ...track })
  }
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
    markCanvasDrawn: () => void
    setError: (error: unknown) => void
    regionTooLarge: boolean
    gateViewport: unknown
    commitFetchBytes: (
      bytes: number[],
      issued: { viewport: unknown; gated: boolean; tierKey: undefined },
    ) => void
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

  // the ring is the display's configured height, under the ruler, shrunk to
  // leave the small test circle half its radius, and the display lays itself
  // out in that band
  const [ring] = host.rings
  expect(ring!.outerPx).toBe(view.radiusPx - RING_GAP_PX)
  expect(ring!.innerPx).toBeCloseTo(
    ring!.outerPx -
      Math.min(display.configuredHeight!, view.radiusPx / 2 - RING_GAP_PX),
  )
  expect(display.height).toBe(Math.floor(ring!.outerPx - ring!.innerPx))
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

// A request is about one genome, so a site reading the strip's blocks takes
// only this track's: the group-by scan read every slice, and threw on the
// other genome's.
test("a single-genome ring's group-by scan reads its own genome's blocks", async () => {
  const { display } = await ringTestSession(
    {
      type: 'FeatureTrack',
      adapter: {
        type: 'FromConfigAdapter',
        features: [
          {
            uniqueId: 'g1',
            refName: 'ctgA',
            start: 100,
            end: 900,
            biotype: 'coding',
          },
          {
            uniqueId: 'g2',
            refName: 'ctgB',
            start: 100,
            end: 900,
            biotype: 'noncoding',
          },
        ],
      },
    },
    'LinearBasicDisplay',
    ['volvox', 'volvox2'],
  )
  await when(() => display.loadedRegions.size === 2, { timeout: 20000 })
  const scan = await (
    display as unknown as {
      scanGroupByCandidates: (opts: {
        signal: AbortSignal
        statusCallback: () => void
      }) => Promise<{ field: string; values: string[] }[]>
    }
  ).scanGroupByCandidates({
    signal: new AbortController().signal,
    statusCallback: () => {},
  })
  expect(scan.find(c => c.field === 'biotype')?.values).toEqual([
    'coding',
    'noncoding',
  ])
}, 30000)

// A gene track taller than its band fits its rows and labels into the band,
// where it was drawn at its own height and shrunk past reading.
test('a feature ring taller than its band lays itself out in the band', async () => {
  const { view, display } = await ringTestSession(
    {
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
      displays: [
        {
          type: 'LinearBasicDisplay',
          displayId: 'ring-LinearBasicDisplay',
          height: 500,
        },
      ],
    },
    'LinearBasicDisplay',
  )
  const [ring] = view.ringHost.rings
  const band = Math.floor(ring!.outerPx - ring!.innerPx)
  expect(band).toBeLessThan(500)
  expect(display.configuredHeight).toBe(500)
  expect(display.height).toBe(band)
})

// The density tier's read and its covered check both take this track's
// genome: a read over every slice threw, and a check over every slice never
// found the other genome covered, so each commit fetched again.
test("a single-genome ring's density tier reads its own genome and settles", async () => {
  const { session, display } = await ringTestSession(
    {
      type: 'FeatureTrack',
      adapter: {
        type: 'BedTabixAdapter',
        bedGzLocation: {
          localPath:
            require.resolve('../../../../test_data/volvox/volvox-bed12.bed.gz'),
        },
        index: {
          location: {
            localPath:
              require.resolve('../../../../test_data/volvox/volvox-bed12.bed.gz.tbi'),
          },
        },
        densityAdapter: {
          type: 'FromConfigAdapter',
          features: scores('ctgA', CTG_A_BP, 1000),
        },
      },
      displays: [
        {
          type: 'LinearBasicDisplay',
          displayId: 'ring-LinearBasicDisplay',
          densityTier: 'density',
        },
      ],
    },
    'LinearBasicDisplay',
    ['volvox', 'volvox2'],
  )
  const tier = display as unknown as {
    host: { bpPerPx: number; coarseBpPerPx: number }
    coarseTierIssueKey: unknown
    coarseTierRead:
      | { key: unknown; regions: { region: { assemblyName: string } }[] }
      | undefined
  }
  // the first read can go out before the view's coarse bp/px settles, and the
  // settled zoom reads again
  await when(
    () =>
      tier.host.coarseBpPerPx === tier.host.bpPerPx &&
      tier.coarseTierRead !== undefined &&
      isDataCurrent(tier.coarseTierRead.key, tier.coarseTierIssueKey),
    { timeout: 20000 },
  )
  expect(display.error).toBeUndefined()
  expect(
    new Set(tier.coarseTierRead!.regions.map(r => r.region.assemblyName)),
  ).toEqual(new Set(['volvox']))

  // a check over every slice refetched every debounce, 300ms
  const rpc = session.rpcManager as unknown as {
    call: (sessionId: string, method: string, args: unknown) => unknown
  }
  const call = rpc.call.bind(rpc)
  let refetches = 0
  rpc.call = (sessionId, method, args) => {
    if (method === 'CoreGetFeatureDensity') {
      refetches++
    }
    return call(sessionId, method, args)
  }
  await new Promise(resolve => {
    setTimeout(resolve, 1500)
  })
  expect(refetches).toBe(0)
}, 30000)

test("a ring's track menu is under the view menu's Tracks item", async () => {
  const { view } = await wiggleSession()
  const [ring] = subMenuOf(view.menuItems(), 'Tracks')
  expect(ring && 'label' in ring ? ring.label : undefined).toBe('ring')
  expect(
    subMenuOf(ring ? [ring] : [], 'ring').map(item =>
      'label' in item ? item.label : undefined,
    ),
  ).toEqual(expect.arrayContaining(['Y axis...']))
}, 30000)

// the ring canvas's first paint is the one an off-screen circle keeps
test('a ring samples its strip only once its display has painted it', async () => {
  const { view, display } = await wiggleSession()
  const host = view.ringHost
  host.setStripElement(
    display.id,
    fakeStrip(Math.round(host.width), display.height).strip,
  )
  expect(host.ringCells).toEqual([])
  display.markCanvasDrawn()
  expect(host.ringCells).toHaveLength(1)
}, 30000)

test('a ring canvas whose displays failed before painting has finished', async () => {
  const { view, display } = await wiggleSession()
  const [pass] = view.ringHost.passes
  expect(pass!.painted).toBe(false)
  display.setError(new Error('boom'))
  expect(pass!.painted).toBe(true)
}, 30000)

// the banner replaces the strip's canvas, which then never paints
test('a ring canvas whose display is too large to fetch has finished', async () => {
  const { view, display } = await ringTestSession(
    {
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features },
      displays: [
        {
          type: 'LinearMarkDisplay',
          displayId: 'ring-LinearMarkDisplay',
          marks: [{ mark: 'bar' }],
        },
      ],
    },
    'LinearMarkDisplay',
  )
  const [pass] = view.ringHost.passes
  expect(pass!.painted).toBe(false)
  display.commitFetchBytes([1e15], {
    viewport: display.gateViewport,
    gated: false,
    tierKey: undefined,
  })
  expect(display.regionTooLarge).toBe(true)
  expect(pass!.painted).toBe(true)
}, 30000)

test('a point on the wiggle ring unwarps to the strip column of its base', async () => {
  const { view, display } = await wiggleSession()
  const host = view.ringHost
  const [ring] = host.rings
  const { strip, canvas } = fakeStrip(Math.round(host.width), display.height)
  host.setStripElement(display.id, strip)
  display.markCanvasDrawn()
  const [cell] = host.ringCells
  expect(cell!.strip.image).toBe(canvas)
  expect(cell!.channels.outerPx[0]).toBe(Math.fround(ring!.outerPx))

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
// neither a neighbour's repaint nor a relayout that leaves this ring's annulus
// where it was may re-copy its strip
test("a ring repainting or resizing leaves the other ring's cell as it was", async () => {
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
    setHeight: (height: number) => void
  }
  for (const d of [display, second] as (typeof second)[]) {
    d.setHeight(20)
    host.setStripElement(
      d.id,
      fakeStrip(Math.round(host.width), d.height).strip,
    )
    d.markCanvasDrawn()
  }
  const cells: (typeof host.ringCells)[] = []
  const dispose = autorun(() => {
    cells.push(host.ringCells)
  })
  await when(() => cells.at(-1)!.length === 2)
  const [first, other] = cells.at(-1)!

  second.markCanvasDrawn()

  const [firstAfter, otherAfter] = cells.at(-1)!
  expect(firstAfter === first).toBe(true)
  expect(otherAfter === other).toBe(false)
  expect(otherAfter!.strip.image === other!.strip.image).toBe(true)

  second.setHeight(30)

  const [firstResized, otherResized] = cells.at(-1)!
  expect(firstResized === first).toBe(true)
  expect(otherResized === otherAfter).toBe(false)
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

// The demo's BEDPE, Hi-C loop and fusion tracks declare only a mark display's
// links, which on a ring arc round the circle where a chord crosses it. From
// the catalog, where a track's displays are only the ones its JSON lists.
test('a variant track declaring only a linear display still opens as chords', async () => {
  const { display } = await ringTestSession(
    {
      type: 'VariantTrack',
      displays: [
        {
          type: 'LinearMarkDisplay',
          displayId: 'ring-LinearMarkDisplay',
          marks: [{ mark: 'link' }],
        },
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
    },
    undefined,
    ['volvox'],
    true,
  )
  expect(display.type).toBe('ChordVariantDisplay')
}, 30000)
