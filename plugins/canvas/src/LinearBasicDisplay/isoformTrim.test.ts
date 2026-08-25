import { packStackedGenes } from '../RenderFeatureDataRPC/testUtils.ts'
import { trimIsoformStack } from './isoformTrim.ts'
import { computeLaidOutData } from './layout.ts'

import type { IsoformStack } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LayoutInputs, LayoutRegionData } from './layout.ts'

// Four children of one gene, 10px each with the 2px gap the worker spent
// between them. `b` is a decoration — an NCBI source record, a
// `biological_region` — sitting between two isoforms, which is the arrangement
// a count alone cannot describe and the one this whole table exists for.
const STACK: IsoformStack = {
  isoformCount: 3,
  gapPx: 2,
  children: [
    { ordinal: 0, isoform: true, rank: 2, yPx: 0 },
    { ordinal: 1, isoform: false, rank: Infinity, yPx: 12 },
    { ordinal: 2, isoform: true, rank: 0, yPx: 24 },
    { ordinal: 3, isoform: true, rank: 1, yPx: 36 },
  ].map(c => ({
    ...c,
    featureId: `tx${c.ordinal}`,
    heightPx: 10,
    labelRows: 1,
    startBp: 100 + c.ordinal * 10,
    endBp: 200 + c.ordinal * 10,
  })),
}

describe('trimIsoformStack', () => {
  it('keeps the best by rank, not the first by drawn order', () => {
    expect([...trimIsoformStack(STACK, 1).keptOrdinals].sort()).toEqual([1, 2])
    expect([...trimIsoformStack(STACK, 2).keptOrdinals].sort()).toEqual([
      1, 2, 3,
    ])
  })

  // The decoration is not one of the isoforms being chosen among, so it is
  // never a loser — and it takes a real row, which is why the trim prices a
  // gene in px rather than counting transcripts.
  it('keeps every decoration whatever the count', () => {
    expect(trimIsoformStack(STACK, 1).keptOrdinals.has(1)).toBe(true)
  })

  it('shifts a decoration below a dropped isoform up into its place', () => {
    const trim = trimIsoformStack(STACK, 1)
    // ordinal 0 went, so the decoration that sat at 12 now starts the stack
    expect(trim.shiftPxByOrdinal.get(1)).toBe(12)
    // and the isoform under it rises by the same 12
    expect(trim.shiftPxByOrdinal.get(2)).toBe(12)
    expect(trim.heightPx).toBe(22)
  })

  it('carries the dropped label rows with the shift', () => {
    const trim = trimIsoformStack(STACK, 1)
    expect(trim.shiftLabelRowsByOrdinal.get(1)).toBe(1)
    expect(trim.shiftLabelRowsByOrdinal.get(2)).toBe(1)
    expect(trim.labelRows).toBe(2)
  })

  it('re-anchors the gene to the bp extent of what is left', () => {
    const trim = trimIsoformStack(STACK, 1)
    expect(trim.startBp).toBe(110)
    expect(trim.endBp).toBe(220)
  })

  // What the badge counts: every isoform the gene HAS and does not draw, which
  // is not the same as the children the trim dropped — a `longestCoding` gene
  // arrives with one child and a count of all of them.
  it('counts the isoforms the gene is missing, not the children dropped', () => {
    expect(trimIsoformStack(STACK, 1).hidden).toBe(2)
    expect(trimIsoformStack(STACK, 3).hidden).toBe(0)
    expect(
      trimIsoformStack(
        { ...STACK, children: [STACK.children[2]!], isoformCount: 3 },
        1,
      ).hidden,
    ).toBe(2)
  })
})

const REGIONS: ReadonlyMap<number, LayoutRegionData> = new Map([
  [
    0,
    {
      regionKey: 'v:ctgA',
      ...packStackedGenes([
        { featureId: 'gene1', startBp: 0, endBp: 1000, isoforms: 6 },
        { featureId: 'gene2', startBp: 5000, endBp: 6000, isoforms: 2 },
      ]),
    },
  ],
])

const INPUTS: LayoutInputs = {
  bpPerPx: 1,
  showLabels: true,
  showDescriptions: false,
  reversedRegions: new Set<number>(),
  displayMode: 'normal',
  pinnedFeatureIds: new Set<string>(),
}

describe('the trimmed region arrays', () => {
  // Thirty-odd parallel fields ride on one index. A filter that misses one
  // draws a row in the wrong colour, at the wrong height, or attributed to a
  // feature that isn't there — and none of them throws.
  it('stay parallel across every rect field', () => {
    const data = computeLaidOutData(REGIONS, {
      ...INPUTS,
      maxIsoformsPerGene: 2,
    }).get(0)!
    const n = data.rectYs.length
    expect(n).toBeLessThan(REGIONS.get(0)!.rectYs.length)
    expect(data.rectHeights.length).toBe(n)
    expect(data.rectColors.length).toBe(n)
    expect(data.rectStrands.length).toBe(n)
    expect(data.rectDensityFade.length).toBe(n)
    expect(data.rectFeatureIndices.length).toBe(n)
    expect(data.rectChildOrdinals.length).toBe(n)
    expect(data.rectPositions.length).toBe(n * 2)
  })

  it('leave every primitive pointing at a flatbush item that exists', () => {
    const data = computeLaidOutData(REGIONS, {
      ...INPUTS,
      maxIsoformsPerGene: 2,
    }).get(0)!
    for (const idx of data.rectFeatureIndices) {
      expect(data.flatbushItems[idx]).toBeDefined()
    }
  })

  it('leave the gene the count does not reach untouched', () => {
    const data = computeLaidOutData(REGIONS, {
      ...INPUTS,
      maxIsoformsPerGene: 2,
    }).get(0)!
    const idx = data.flatbushItems.findIndex(i => i.featureId === 'gene2')
    const kept = new Set<number>()
    for (const [i, feature] of data.rectFeatureIndices.entries()) {
      if (feature === idx) {
        kept.add(data.rectChildOrdinals[i]!)
      }
    }
    expect(kept.size).toBe(2)
  })

  // The `full` rung packs at no count at all, and the GPU upload diff and the
  // Y-morph idle check both key on array identity — so a rung that trims
  // nothing must allocate nothing.
  it('are the worker’s own, by reference, when nothing is trimmed', () => {
    const raw = REGIONS.get(0)!
    const data = computeLaidOutData(REGIONS, INPUTS).get(0)!
    expect(data.rectPositions).toBe(raw.rectPositions)
    expect(data.rectColors).toBe(raw.rectColors)
    expect(data.rectFeatureIndices).toBe(raw.rectFeatureIndices)
    expect(data.rectChildOrdinals).toBe(raw.rectChildOrdinals)
  })
})
