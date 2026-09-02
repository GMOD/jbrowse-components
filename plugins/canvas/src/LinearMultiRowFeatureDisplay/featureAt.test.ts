import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { collectLegendCandidates } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// The interaction surface of this display — the hover tooltip, click-to-open
// details and the right-click menu all resolve their feature through
// `featureAt`. Its geometric twin `blockScreenRect` is pinned in
// blockScreenRect.test.ts; this is the other half, and the two have to agree
// about which block sits under a pixel.

const RED = cssColorToABGR('red')
const BLUE = cssColorToABGR('blue')

interface Feat {
  row: string
  start: number
  end: number
  color?: number
  name?: string
  id?: string
}

// Region payload in the shape the worker ships: rows referenced indirectly
// through a deduplicated `partitionValues` list.
function region(feats: Feat[], opts?: { usedItemRgb?: boolean }) {
  const partitionValues: string[] = []
  const index = new Map<string, number>()
  const featurePartitionIndex = new Uint32Array(feats.length)
  feats.forEach((f, i) => {
    let idx = index.get(f.row)
    if (idx === undefined) {
      idx = partitionValues.length
      partitionValues.push(f.row)
      index.set(f.row, idx)
    }
    featurePartitionIndex[i] = idx
  })
  const packed = {
    featureStarts: Uint32Array.from(feats, f => f.start),
    featureEnds: Uint32Array.from(feats, f => f.end),
    featureColors: Uint32Array.from(feats, f => f.color ?? RED),
    featureDeltas: new Int32Array(0),
    partitionValues,
    featurePartitionIndex,
    featureNames: feats.map(f => f.name ?? ''),
    featureIds: feats.map((f, i) => f.id ?? `f${i}`),
    usedItemRgb: opts?.usedItemRgb ?? false,
    partitionCandidates: [],
    resolvedPartitionField: 'name',
  }
  return {
    ...packed,
    legendCandidates: collectLegendCandidates(packed),
  } satisfies MultiRowRegionData
}

const CTGA_1KB = [
  { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
]

// Rows sort by partition value, so 'a' is row 0 and 'b' row 1; with two rows in
// the default 100px display each band is 50px tall.
function twoRowDisplay(regionData: MultiRowRegionData, regions = CTGA_1KB) {
  const { display, view } = createTestEnvironment().createDisplay(regions)
  display.setRpcData(0, regionData)
  return { display, view }
}

describe('featureAt', () => {
  it('resolves the feature under a display-relative pixel', () => {
    const { display } = twoRowDisplay(
      region([
        { row: 'a', start: 100, end: 200, id: 'top' },
        { row: 'b', start: 300, end: 400, id: 'bottom', name: 'seg' },
      ]),
    )
    expect(display.effectiveRowHeight).toBe(50)

    expect(display.featureAt(350, 75)).toEqual({
      id: 'bottom',
      regionIndex: 0,
      rowName: 'b',
      name: 'seg',
      refName: 'ctgA',
      start: 300,
      end: 400,
    })
  })

  it('takes the row from mouseY, so the same column misses on another row', () => {
    const { display } = twoRowDisplay(
      region([
        { row: 'a', start: 0, end: 50 },
        { row: 'b', start: 300, end: 400 },
      ]),
    )
    // row 0's band, same genomic column as the feature on row 1
    expect(display.featureAt(350, 10)).toBeUndefined()
    expect(display.featureAt(350, 75)).toBeDefined()
  })

  it('is undefined over a gap on an occupied row', () => {
    const { display } = twoRowDisplay(
      region([{ row: 'a', start: 100, end: 200 }]),
    )
    expect(display.featureAt(250, 10)).toBeUndefined()
  })

  it('treats the end coordinate as exclusive, matching the painted span', () => {
    const { display } = twoRowDisplay(
      region([{ row: 'a', start: 100, end: 200 }]),
    )
    expect(display.featureAt(199, 10)).toBeDefined()
    expect(display.featureAt(200, 10)).toBeUndefined()
  })

  // Both render paths draw a zero-length feature (an insertion): the block is
  // widened to MULTI_ROW_MIN_CELL_PX from its start edge, by `spanLeft` on
  // Canvas2D and `extendToMinWidthX` in the shader. `start <= bp && bp < end` is
  // empty when the two are equal, so the block on screen had no hover, no
  // tooltip, no click-to-details and no context menu — the same degenerate span
  // the details narrowing had to widen.
  it('resolves a zero-length feature at the base it is painted from', () => {
    const { display, view } = twoRowDisplay(
      region([
        { row: 'a', start: 400, end: 400, id: 'insertion' },
        { row: 'b', start: 0, end: 1000 },
      ]),
    )
    expect(view.bpPerPx).toBe(1)
    expect(display.featureAt(400, 10)?.id).toBe('insertion')
    // Nothing to the LEFT of the start edge, which is where both painters widen
    // away from. To the right the claim is deliberately the painted one and no
    // wider: the block is MULTI_ROW_MIN_CELL_PX across, 2px at this 1bp/px, and
    // the pixel it covers has to hit or the mark on screen has no tooltip. This
    // assertion read `undefined` at 401 while that pixel was painted.
    expect(display.featureAt(399, 10)).toBeUndefined()
    expect(display.featureAt(401, 10)?.id).toBe('insertion')
    expect(display.featureAt(402, 10)).toBeUndefined()
  })

  // A repeat element on an rmsk painting at chromosome zoom: hundreds of bp
  // inside one pixel, drawn as the shader's minimum cell and answering for
  // nothing the cursor could reach.
  it('resolves a feature narrower than the cell it is painted as', () => {
    const { display, view } = createTestEnvironment().createDisplay([
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ])
    view.zoomTo(10_000)
    expect(view.bpPerPx).toBe(10_000)
    // the 10Mb region is centred in the 800px view at this zoom, so px 500 is
    // over it and px 300 is off its left edge
    const start = view.pxToBp(500).coord0

    display.setRpcData(
      0,
      region([
        { row: 'a', start, end: start + 300, id: 'alu' },
        { row: 'b', start: 0, end: 10_000_000 },
      ]),
    )

    // 300bp is 0.03px, and the painted block is the 2px floor from px 500
    expect(display.featureAt(500, 10)?.id).toBe('alu')
    expect(display.featureAt(501, 10)?.id).toBe('alu')
    // and no wider than what is painted
    expect(display.featureAt(502, 10)).toBeUndefined()
    expect(display.featureAt(499, 10)).toBeUndefined()
  })

  it('is undefined past the last row rather than clamping to it', () => {
    const { display } = twoRowDisplay(
      region([{ row: 'a', start: 100, end: 200 }]),
    )
    // one row discovered, so the whole 100px display is row 0; 150 is past it
    expect(display.featureAt(150, 150)).toBeUndefined()
  })

  it('resolves overlapping features to the one painted on top', () => {
    // both render paths paint in array order, so the later feature is the one
    // actually visible and the hit has to name it
    const { display } = twoRowDisplay(
      region([
        { row: 'a', start: 100, end: 400, id: 'under' },
        { row: 'a', start: 200, end: 300, id: 'over' },
      ]),
    )
    expect(display.featureAt(250, 10)?.id).toBe('over')
    expect(display.featureAt(150, 10)?.id).toBe('under')
  })

  it('is undefined off the end of the displayed regions', () => {
    const { display } = twoRowDisplay(
      region([{ row: 'a', start: 100, end: 200 }]),
      [{ refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }],
    )
    // the view is 800px wide over a 200bp region, so most of it is off the end
    expect(display.featureAt(500, 10)).toBeUndefined()
  })

  it('is undefined for a region whose features have not loaded', () => {
    const { display } = createTestEnvironment().createDisplay(CTGA_1KB)
    expect(display.featureAt(150, 10)).toBeUndefined()
  })

  // `pxToBp`'s coord0 floors, which reversed names the base to the *right* of
  // the one drawn under the cursor — so a 1bp feature would hit one pixel off,
  // in the direction nobody checks. basePaintedAt is the readout that agrees
  // with what the painter drew.
  it('names the base painted at the pixel on a reversed region', () => {
    const reversed = [
      {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
        reversed: true,
      },
    ]
    const { display, view } = twoRowDisplay(
      region([{ row: 'a', start: 899, end: 900, id: 'onepx' }]),
      reversed,
    )
    // the pixel paints base 899 while coord0 there reports 900
    expect(view.pxToBp(100).coord0).toBe(900)
    expect(display.featureAt(100, 10)?.id).toBe('onepx')
  })

  describe('hidden legend categories', () => {
    // usedItemRgb suppresses the per-row palette, which is what leaves the rows
    // painting their per-feature colors and gives the legend something to key on
    const painted = () =>
      region(
        [
          {
            row: 'a',
            start: 100,
            end: 200,
            color: RED,
            name: 'cat1',
            id: 'a1',
          },
          {
            row: 'b',
            start: 100,
            end: 200,
            color: BLUE,
            name: 'cat2',
            id: 'b1',
          },
        ],
        { usedItemRgb: true },
      )

    it('drops a feature whose color is toggled off', () => {
      const { display } = twoRowDisplay(painted())
      expect(display.colorLegend.map(e => e.label)).toEqual(['cat1', 'cat2'])
      expect(display.featureAt(150, 10)?.id).toBe('a1')

      display.toggleCategory('cat1')

      expect(display.featureAt(150, 10)).toBeUndefined()
      // the other category is untouched
      expect(display.featureAt(150, 75)?.id).toBe('b1')
    })

    it('keeps a feature on a row painting its own color override', () => {
      // the row paints the override, which the legend never lists, so a baked
      // color that happens to match a hidden category must not hide it — the
      // same rule both render paths follow
      const { display } = twoRowDisplay(
        region(
          [
            {
              row: 'a',
              start: 100,
              end: 200,
              color: RED,
              name: 'cat1',
              id: 'a1',
            },
            {
              row: 'b',
              start: 100,
              end: 200,
              color: RED,
              name: 'cat1',
              id: 'b1',
            },
          ],
          { usedItemRgb: true },
        ),
      )
      display.setLayout([{ name: 'a', color: 'green' }, { name: 'b' }])
      display.toggleCategory('cat1')

      expect(display.featureAt(150, 10)?.id).toBe('a1')
      expect(display.featureAt(150, 75)).toBeUndefined()
    })
  })

  // A reorder renumbers the rows with no pointer event to re-run the hit test,
  // so a hit that snapshotted its row INDEX named whoever moved into it — the
  // tooltip labelled the wrong sample and the highlight box moved to its row.
  // The hit carries the row's name instead, and both consumers resolve it live.
  it('a hover survives a row reorder on the row it was taken on', () => {
    const { display } = twoRowDisplay(
      region([
        { row: 'a', start: 100, end: 200, id: 'top' },
        { row: 'b', start: 300, end: 400, id: 'bottom' },
      ]),
    )
    display.setHoveredFeature(display.featureAt(350, 75))
    expect(display.hoveredRow?.name).toBe('b')
    const before = display.highlightedBlockRect

    display.setLayout([{ name: 'b' }, { name: 'a' }])

    expect(display.hoveredRow?.name).toBe('b')
    expect(display.highlightedBlockRect?.top).toBeLessThan(before!.top)
  })

  // The bound is the sidebar's *interactive* edge (label gutter + resize
  // handle), not where labels are drawn from: a hit under the handle would
  // fight the drag. Same bound the crosshair's guide stops at.
  it('is undefined over the tree sidebar and its resize handle', () => {
    const { display } = twoRowDisplay(
      region([
        { row: 'a', start: 0, end: 1000, id: 'wide' },
        { row: 'b', start: 0, end: 1000, id: 'wide2' },
      ]),
    )
    // the gutter is only reserved once a tree is positioned against the rows
    display.setLayoutAndClusterTree(
      [{ name: 'a' }, { name: 'b' }],
      '(a:1,b:1);',
    )
    expect(display.sidebarOffset).toBeGreaterThan(0)
    const edge = display.sidebarOffset + 4

    expect(display.featureAt(edge - 1, 10)).toBeUndefined()
    expect(display.featureAt(edge, 10)?.id).toBe('wide')
  })
})
