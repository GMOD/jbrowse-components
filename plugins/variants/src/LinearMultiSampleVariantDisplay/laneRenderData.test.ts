import { resolvePalette } from '@jbrowse/core/ui/palette'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { computeLaidOutData, maxBottom } from '@jbrowse/plugin-canvas'

import { laneDisplayConfig } from './laneDisplayConfig.ts'
import { buildLaneRenderData } from './laneRenderData.ts'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { LaneSourceData } from './laneRenderData.ts'
import type { ShowLabelsMode } from '@jbrowse/plugin-canvas'

const jexl = createJexlInstance()
const palette = resolvePalette({})
const region = {
  displayedRegionIndex: 0,
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

function info(name: string, over?: Partial<VariantFeatureInfo>) {
  return {
    ref: 'N',
    alt: ['<DEL>'],
    name,
    description: 'sv',
    length: 1,
    insertedBp: 0,
    type: 'deletion',
    genotypeCodes: new Uint32Array(),
    ...over,
  }
}

// Records as [id, start, end], in VCF order (by POS), which is the order the
// payload holds them in.
function source(
  records: [string, number, number][],
  colors?: string[],
): LaneSourceData {
  return {
    featurePositions: Uint32Array.from(records.flatMap(([, s, e]) => [s, e])),
    featureColors: Uint32Array.from(
      records.map((_, i) => cssColorToABGR(colors?.[i] ?? 'goldenrod')),
    ),
    featureIdList: records.map(([id]) => id),
    featureGenotypeMap: Object.fromEntries(
      records.map(([id]) => [id, info(id)]),
    ),
  }
}

function laidOut(
  data: LaneSourceData,
  {
    labels = 'none',
    bpPerPx = 10,
  }: { labels?: ShowLabelsMode; bpPerPx?: number } = {},
) {
  const built = buildLaneRenderData({
    data,
    region,
    config: laneDisplayConfig({ labels, featureHeight: 10 }),
    palette,
    jexl,
  })
  return computeLaidOutData(new Map([[0, built]]), {
    bpPerPx,
    reversedRegions: new Set(),
    displayMode: 'compact',
    pinnedFeatureIds: new Set(),
    showLabels: labels !== 'none',
    showDescriptions: false,
  })
}

function itemsById(map: ReturnType<typeof laidOut>) {
  return new Map(
    [...map.values()].flatMap(r =>
      r.flatbushItems.map(i => [i.featureId, i] as const),
    ),
  )
}

// The whole reason the band went through plugin-canvas. Two SVs that overlap
// partially — the short one starting first, which is the arrangement VCF order
// produces and the one a single-row painter cannot express — have to end up on
// different rows rather than one overdrawing the other.
test('two overlapping records stack onto separate rows', () => {
  const items = itemsById(
    laidOut(
      source([
        ['del', 1000, 2000],
        ['inv', 1500, 8000],
      ]),
    ),
  )
  const del = items.get('del')!
  const inv = items.get('inv')!
  expect(del.topPx).not.toBe(inv.topPx)
  // and neither is pushed off the layout
  expect(Math.min(del.topPx, inv.topPx)).toBe(0)
})

test('records that do not overlap share one row', () => {
  const items = itemsById(
    laidOut(
      source([
        ['a', 1000, 2000],
        ['b', 5000, 6000],
      ]),
    ),
  )
  expect(items.get('a')!.topPx).toBe(items.get('b')!.topPx)
})

// A stack of overlaps is taller than a single row, which is what the fit ladder
// then has to spend the band's height on — the band cannot grow, so this is the
// number `laneFitStage` reads.
test('a pile of overlapping records makes a taller stack', () => {
  const one = laidOut(source([['a', 1000, 2000]]))
  const three = laidOut(
    source([
      ['a', 1000, 5000],
      ['b', 1500, 5500],
      ['c', 2000, 6000],
    ]),
  )
  expect(maxBottom(three)).toBeGreaterThan(maxBottom(one))
})

// The lane's marks are the same color as the alt cells in the column under
// them, and this is the seam that carries it: `config.color` is unset, so
// plugin-canvas's `getBoxColor` reads the color each rebuilt feature declares
// for itself. A concrete `color` slot would repaint every mark alike.
test('each record keeps the color the display resolved for it', () => {
  const map = laidOut(
    source(
      [
        ['a', 1000, 2000],
        ['b', 5000, 6000],
      ],
      ['red', 'blue'],
    ),
  )
  const data = map.get(0)!
  const colorOf = (id: string) => {
    const idx = data.flatbushItems.findIndex(i => i.featureId === id)
    const rect = [...data.rectFeatureIndices].indexOf(idx)
    return data.rectColors[rect]
  }
  expect(colorOf('a')).not.toBe(colorOf('b'))
  // packed RGBA, not the ABGR the payload ships — the point is that the two
  // records arrived at plugin-canvas as two different colors at all
  expect(abgrToCssRgba(cssColorToABGR('red'))).toBe('rgba(255,0,0,1)')
})

// The label mode is expressed by withholding the jexl, which is how
// plugin-canvas turns a kind off — so `none` must produce no label data at all
// rather than a blank one that still reserves row height.
test('label mode none letters nothing', () => {
  const withNames = laidOut(source([['rs1', 1000, 2000]]), { labels: 'name' })
  const without = laidOut(source([['rs1', 1000, 2000]]), { labels: 'none' })
  expect(withNames.get(0)!.floatingLabelsData.rs1?.nameLabel?.text).toBe('rs1')
  expect(without.get(0)!.floatingLabelsData.rs1?.nameLabel).toBeUndefined()
})
