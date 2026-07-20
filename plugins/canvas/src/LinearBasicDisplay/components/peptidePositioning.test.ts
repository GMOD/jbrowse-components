import { forEachRenderedPeptide } from './peptidePositioning.ts'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { PeptideCell } from './peptidePositioning.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

function makeItem(
  overrides: Partial<AminoAcidOverlayItem> = {},
): AminoAcidOverlayItem {
  return {
    startBp: 100,
    endBp: 130,
    aminoAcid: 'M',
    proteinIndex: 0,
    topPx: 5,
    heightPx: 10,
    isStopOrNonTriplet: false,
    isTranslExcept: false,
    flatbushIdx: 0,
    ...overrides,
  }
}

function makeData(overlay?: AminoAcidOverlayItem[]): FeatureDataResult {
  return { aminoAcidOverlay: overlay } as FeatureDataResult
}

// FULL_REGION maps bp 1:1 to px (span and screen width both 1000), so a cell's
// centerPx equals the midpoint of its bp span.
const FULL_REGION: BpRegionBounds = {
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
}

function collect(data: FeatureDataResult, vr: BpRegionBounds) {
  const out: {
    item: AminoAcidOverlayItem
    cell: PeptideCell
    index: number
  }[] = []
  forEachRenderedPeptide(data, vr, (item, cell, index) => {
    out.push({ item, cell, index })
  })
  return out
}

describe('forEachRenderedPeptide', () => {
  test('emits nothing when there is no amino acid overlay', () => {
    expect(collect(makeData(undefined), FULL_REGION)).toHaveLength(0)
  })

  test('skips cells whose bp span is outside the region', () => {
    const data = makeData([makeItem({ startBp: 600, endBp: 630 })])
    expect(collect(data, { ...FULL_REGION, start: 0, end: 500 })).toHaveLength(
      0,
    )
  })

  test('centers the cell at the midpoint of its mapped px span', () => {
    const [emitted] = collect(makeData([makeItem()]), FULL_REGION)
    expect(emitted!.cell.centerPx).toBe(115)
  })

  test('caps font size at 16 for tall cells but uses height when smaller', () => {
    const tall = collect(makeData([makeItem({ heightPx: 40 })]), FULL_REGION)
    expect(tall[0]!.cell.fontSize).toBe(16)
    const short = collect(makeData([makeItem({ heightPx: 9 })]), FULL_REGION)
    expect(short[0]!.cell.fontSize).toBe(9)
  })

  test('appends the residue number once the cell is at least 20px wide', () => {
    const data = makeData([
      makeItem({ startBp: 100, endBp: 130, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, FULL_REGION)[0]!.cell.text).toBe('M1')
  })

  test('omits the residue number when the cell is narrower than 20px', () => {
    const data = makeData([
      makeItem({ startBp: 100, endBp: 110, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, FULL_REGION)[0]!.cell.text).toBe('M')
  })

  test('passes through the array index of each emitted cell', () => {
    const data = makeData([
      makeItem({ startBp: 100, endBp: 130 }),
      makeItem({ startBp: 200, endBp: 230 }),
    ])
    expect(collect(data, FULL_REGION).map(e => e.index)).toEqual([0, 1])
  })

  test('centers correctly in a reversed region', () => {
    const [emitted] = collect(makeData([makeItem()]), {
      ...FULL_REGION,
      reversed: true,
    })
    // reversed maps bp b -> 1000 - b, so 100..130 -> 900..870, midpoint 885
    expect(emitted!.cell.centerPx).toBe(885)
  })
})
