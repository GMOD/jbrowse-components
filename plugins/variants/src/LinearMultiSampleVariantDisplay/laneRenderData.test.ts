import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { computeLaidOutData } from '@jbrowse/plugin-canvas'

import { laneDisplayConfig } from './laneDisplayConfig.ts'
import { buildLaneRenderData, laneRecordsAtZoom } from './laneRenderData.ts'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { LaneSourceData } from './laneRenderData.ts'
import type { ShowLabelsMode } from '@jbrowse/plugin-canvas'

const jexl = createJexlInstance()
const region = {
  displayedRegionIndex: 0,
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

function info(name: string, over?: Partial<VariantFeatureInfo>) {
  return {
    featureId: name,
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
    featureInfo: records.map(([id]) => info(id)),
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
    jexl,
  })
  return computeLaidOutData(new Map([[0, built]]), {
    bpPerPx,
    reversedRegions: new Set(),
    displayMode: 'compact',
    pinnedFeatureIds: new Set(),
    showLabels: labels !== 'none',
    showDescriptions: false,
    flattenRows: true,
  })
}

function itemsById(map: ReturnType<typeof laidOut>) {
  return new Map(
    [...map.values()].flatMap(r =>
      r.flatbushItems.map(i => [i.featureId, i] as const),
    ),
  )
}

// The lane is one row, as the display lays it out: records that overlap share
// pixels, and the packer drops a label that would overprint a kept one.
test('overlapping records share one row', () => {
  const items = itemsById(
    laidOut(
      source([
        ['del', 1000, 2000],
        ['inv', 1500, 8000],
      ]),
    ),
  )
  expect(items.get('del')!.topPx).toBe(0)
  expect(items.get('inv')!.topPx).toBe(0)
})

// The lane's marks are the same color as the alt cells in the column under
// them, and this is the seam that carries it: `config.color` is unset, so
// plugin-canvas's `boxColor` reads the color each rebuilt feature declares
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
  expect(withNames.get(0)!.floatingLabelsData.get('rs1')?.nameLabel?.text).toBe(
    'rs1',
  )
  expect(
    without.get(0)!.floatingLabelsData.get('rs1')?.nameLabel,
  ).toBeUndefined()
})

describe('laneRecordsAtZoom', () => {
  const colors = (n: number) => new Uint32Array(n).fill(1)

  test('keeps everything below the first binned zoom', () => {
    expect(
      laneRecordsAtZoom(
        {
          featurePositions: Uint32Array.of(0, 1, 0, 1),
          featureColors: colors(2),
        },
        1,
      ),
    ).toBeUndefined()
  })

  test('keeps the last record of each bin, in payload order', () => {
    expect(
      laneRecordsAtZoom(
        {
          featurePositions: Uint32Array.of(0, 1, 1, 2, 2, 3, 9, 10, 17, 18),
          featureColors: colors(5),
        },
        8,
      ),
    ).toEqual([2, 3, 4])
  })

  test('a wider record and a second color survive their bin', () => {
    expect(
      laneRecordsAtZoom(
        {
          featurePositions: Uint32Array.of(0, 1, 1, 100, 2, 3, 3, 4),
          featureColors: Uint32Array.of(1, 1, 1, 2),
        },
        8,
      ),
    ).toEqual([1, 2, 3])
  })

  test('one record per bin leaves nothing to drop', () => {
    expect(
      laneRecordsAtZoom(
        {
          featurePositions: Uint32Array.of(0, 3, 8, 9, 16, 17),
          featureColors: colors(3),
        },
        8,
      ),
    ).toBeUndefined()
  })
})
