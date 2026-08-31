import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { syntenyFetchRegions } from '@jbrowse/synteny-core'

import { executeSyntenyFeaturesAndPositions } from './executeSyntenyFeaturesAndPositions.ts'
import { computeSyntenyColors } from './syntenyColors.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { AttributeRange, SyntenyColorBy } from '@jbrowse/synteny-core'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// A ribbon's color must not depend on where the view happens to be scrolled to.
// Panning re-runs the fetch against a different snapped window, so the worker
// sees a different slice of the file every time that window rolls over, and
// everything the color function reads off the answer — the refName dictionary,
// the draw-order sort, the feature index each instance points at — is rebuilt
// from that slice. This drives the real worker path at a series of pan
// positions and checks that a feature two of them share is painted the same in
// both, and stacks in the same order relative to the others they share.

const QUERY_ASM = 'query'
const TARGET_ASM = 'target'
const CONTIG_LEN = 60_000
const QUERY_CONTIGS = ['q1', 'q2', 'q3']
const TARGET_CONTIGS = ['t1', 't2', 't3']
const WIDTH = 800
const BP_PER_PX = 10
// The snapped fetch grid these settings produce, so the pan steps below can be
// chosen to roll it over while still overlapping.
const GRID_BP = 2000 * BP_PER_PX

function region(assemblyName: string, refName: string): Region {
  return { assemblyName, refName, start: 0, end: CONTIG_LEN }
}

const queryRegions = QUERY_CONTIGS.map(r => region(QUERY_ASM, r))
const targetRegions = TARGET_CONTIGS.map(r => region(TARGET_ASM, r))

// A cumBp coordinate on the target axis, back as the (contig, offset) pair a
// mate is spelled with.
function targetAt(cumBp: number) {
  const axis = CONTIG_LEN * TARGET_CONTIGS.length
  const clamped = Math.max(0, Math.min(axis - 1, cumBp))
  const index = Math.floor(clamped / CONTIG_LEN)
  return {
    refName: TARGET_CONTIGS[index]!,
    start: clamped - index * CONTIG_LEN,
  }
}

// Alignments of assorted sizes along every query contig, mated near their own
// diagonal so both ends stay inside the culled band, and shifted by enough to
// put neighbouring alignments on different target contigs — the arrangement
// chromosome painting is actually looked at in.
const ALIGNMENTS = QUERY_CONTIGS.flatMap((refName, qi) =>
  Array.from({ length: 100 }, (_, i) => {
    const start = i * 600
    const end = start + 200 + ((i * 7919) % 3000)
    const cumBp = qi * CONTIG_LEN + start
    const mate = targetAt(cumBp + ((i % 5) - 2) * 9000)
    return new SimpleFeature({
      uniqueId: `${refName}-${i}`,
      refName,
      start,
      end,
      strand: i % 3 === 0 ? -1 : 1,
      assemblyName: QUERY_ASM,
      // a declared numeric column, the input an `attribute:<name>` ramp paints.
      // Trends along the axis, so which slice of the file is in hand decides
      // what span the column covers.
      score: Math.round(cumBp / 100),
      mate: {
        refName: mate.refName,
        start: mate.start,
        end: mate.start + (end - start),
        assemblyName: TARGET_ASM,
      },
    })
  }),
)

// An indexed adapter answers about the window it was handed and nothing else,
// which is the whole reason a pan changes what the worker sees.
function featuresIn(regions: Region[]) {
  return ALIGNMENTS.filter(f =>
    regions.some(
      r =>
        r.refName === f.get('refName') &&
        f.get('end') > r.start &&
        f.get('start') < r.end,
    ),
  )
}

function visibleRegionsFor(offsetPx: number) {
  const left = offsetPx * BP_PER_PX
  const right = left + WIDTH * BP_PER_PX
  return queryRegions.flatMap((r, displayedRegionIndex) => {
    const base = displayedRegionIndex * CONTIG_LEN
    const start = Math.max(0, left - base)
    const end = Math.min(CONTIG_LEN, right - base)
    return start < end ? [{ ...r, start, end, displayedRegionIndex }] : []
  })
}

async function fetchAt(offsetPx: number) {
  const fetchRegions = syntenyFetchRegions({
    visibleRegions: visibleRegionsFor(offsetPx),
    displayedRegions: queryRegions,
    width: WIDTH,
    bpPerPx: BP_PER_PX,
  })
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesInMultipleRegionsArray: async (regions: Region[]) =>
      regions[0]?.assemblyName === QUERY_ASM ? featuresIn(regions) : [],
  } as never)
  return unwrapRpcResult(
    await executeSyntenyFeaturesAndPositions({
      pluginManager: {} as PluginManager,
      sessionId: 'pan',
      adapterConfig: { type: 'PAFAdapter', attributeColumns: ['score'] },
      queryView: {
        bpPerPx: BP_PER_PX,
        offsetPx,
        width: WIDTH,
        displayedRegions: queryRegions,
        fetchRegions,
      },
      targetView: {
        bpPerPx: BP_PER_PX,
        offsetPx,
        displayedRegions: targetRegions,
      },
    }),
  )
}

type Fetched = Awaited<ReturnType<typeof fetchAt>>

// featureId -> the color its ribbon body was painted, which is what a reader
// sees as "that ribbon's color". CIGAR and marker instances carry the scheme's
// own fixed colors and are not what chromosome painting is read off.
function colorsById(
  fetched: Fetched,
  colorBy: SyntenyColorBy,
  attributeRanges: Record<string, AttributeRange>,
) {
  const { instanceData, ...featureData } = fetched
  const colors = computeSyntenyColors({
    groundColor: '#fff',
    instanceData,
    featureData,
    colorBy,
    trackColor: '#f00',
    nameOrder: colorBy === 'target' ? TARGET_CONTIGS : QUERY_CONTIGS,
    attributeRanges,
  })
  const out = new Map<string, number>()
  for (let i = 0; i < instanceData.instanceCount; i++) {
    if (instanceData.kinds[i] === 0) {
      const id = featureData.featureIds[instanceData.instanceFeatureIdx[i]!]!
      out.set(id, colors[i]!)
    }
  }
  return out
}

// The order features first appear in the instance array, which is the order
// they paint in and therefore which of two overlapping ribbons is on top.
function paintOrder(fetched: Fetched) {
  const { instanceData, featureIds } = fetched
  const seen = new Set<string>()
  const order: string[] = []
  for (let i = 0; i < instanceData.instanceCount; i++) {
    const id = featureIds[instanceData.instanceFeatureIdx[i]!]!
    if (!seen.has(id)) {
      seen.add(id)
      order.push(id)
    }
  }
  return order
}

function widen(
  into: Record<string, AttributeRange>,
  ranges: Record<string, AttributeRange>,
) {
  const out = { ...into }
  for (const [name, range] of Object.entries(ranges)) {
    const prev = out[name]
    out[name] = prev
      ? {
          min: Math.min(prev.min, range.min),
          max: Math.max(prev.max, range.max),
        }
      : range
  }
  return out
}

// A pan of one grid cell, four times over: each step refetches against a window
// that has rolled over, while still overlapping the one before it.
const OFFSETS = [0, 1, 2, 3, 4].map(i => (i * GRID_BP) / BP_PER_PX)

describe('a ribbon keeps its color and its place in the stack across a pan', () => {
  test.each<SyntenyColorBy>(['query', 'target', 'attribute:score'])(
    'colorBy: %s',
    async colorBy => {
      const fetches = await Promise.all(OFFSETS.map(o => fetchAt(o)))
      // The view's domain, not each payload's. It is accumulated across fetches
      // (`TrackColorsMixin.attributeRanges`) precisely so that it settles, and
      // once it has, the same domain paints every window — which is the state
      // this checks the colors in. A ramp scaled to whatever slice is in hand
      // instead re-maps every feature each time a pan rolls the window over,
      // and the ribbon a reader is looking at changes color under them.
      const ranges = fetches.reduce<Record<string, AttributeRange>>(
        (acc, f) => widen(acc, f.attributeRanges),
        {},
      )
      const maps = fetches.map(f => colorsById(f, colorBy, ranges))
      for (const [i, map] of maps.entries()) {
        for (const prev of maps.slice(0, i)) {
          const shared = [...map.keys()].filter(id => prev.has(id))
          const changed = shared.filter(id => prev.get(id) !== map.get(id))
          expect({ offsetPx: OFFSETS[i], changed }).toEqual({
            offsetPx: OFFSETS[i],
            changed: [],
          })
        }
      }
      // the pans genuinely overlap, or the check above is vacuous
      const overlap = [...maps[1]!.keys()].filter(id => maps[0]!.has(id))
      expect(overlap.length).toBeGreaterThan(10)
    },
  )

  test('paint order', async () => {
    const orders = (await Promise.all(OFFSETS.map(o => fetchAt(o)))).map(
      paintOrder,
    )
    for (const [i, order] of orders.entries()) {
      for (const prev of orders.slice(0, i)) {
        const inPrev = new Set(prev)
        const inThis = new Set(order)
        expect({
          offsetPx: OFFSETS[i],
          order: order.filter(id => inPrev.has(id)),
        }).toEqual({
          offsetPx: OFFSETS[i],
          order: prev.filter(id => inThis.has(id)),
        })
      }
    }
  })
})
