import { measureText } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { PEPTIDE_TEXT_MAX_BP_PER_PX } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { drawPeptides, forEachRenderedPeptide } from './peptidePositioning.ts'

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
  }[] = []
  forEachRenderedPeptide(data, vr, (item, cell) => {
    out.push({ item, cell })
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

  test('appends the residue number when the label fits the cell', () => {
    const data = makeData([
      makeItem({ startBp: 100, endBp: 130, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, FULL_REGION)[0]!.cell.text).toBe('M1')
  })

  test('omits the residue number when the label is wider than the cell', () => {
    const data = makeData([
      makeItem({ startBp: 100, endBp: 110, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, FULL_REGION)[0]!.cell.text).toBe('M')
  })

  // The bug a flat px threshold could not see: at the coarsest zoom the letters
  // draw at (bpPerPx 1/8), a whole codon is 24px, so a 20px threshold said "the
  // number fits" for every residue in the proteome. `M12345` on TTN is six
  // monospace characters — 36.6px at the default 10px feature height — and ran
  // into both its neighbours.
  test('drops the number for a high residue index that would overrun a cell the letter fits', () => {
    // 3bp mapped 1:1 to 3px * 8 = 24px, the tightest cell that ever draws text
    const region: BpRegionBounds = { ...FULL_REGION, start: 0, end: 125 }
    const at = (proteinIndex: number) =>
      collect(
        makeData([
          makeItem({
            startBp: 0,
            endBp: 3,
            aminoAcid: 'M',
            proteinIndex,
            heightPx: 10,
          }),
        ]),
        region,
      )[0]!.cell.text
    expect(at(0)).toBe('M1')
    expect(at(34349)).toBe('M')
  })

  // superCompact scales the feature body by 0.3 (HEIGHT_MULTIPLIERS), which puts
  // a default 10px feature's letters at 3px — the illegibility that
  // LABEL_FONT_MULTIPLIERS exists to keep floating labels out of.
  test('draws nothing at a font size too small to read', () => {
    expect(collect(makeData([makeItem({ heightPx: 3 })]), FULL_REGION)).toEqual(
      [],
    )
    expect(
      collect(makeData([makeItem({ heightPx: 6 })]), FULL_REGION),
    ).toHaveLength(1)
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

// The claim the cell layout above exists to make, asserted on what is actually
// PAINTED rather than on the numbers feeding it: at the coarsest zoom the
// letters ever draw at, no residue's text may reach its neighbour's. Driven
// through SvgCanvas because it records each draw as a `<text x=...>` element —
// the same 2D-context surface the SVG export paints peptides onto, so this
// covers the export path as well as the on-screen one.
describe('drawPeptides at the tightest zoom that draws text', () => {
  // A run of codons tiling the region, numbered from `firstIndex` — the digit
  // count is what decides whether the residue number fits.
  function paintedTexts(firstIndex: number, count = 6, heightPx = 10) {
    const cellBp = 3
    const region: BpRegionBounds = {
      start: 0,
      end: cellBp * count,
      screenStartPx: 0,
      screenEndPx: (cellBp * count) / PEPTIDE_TEXT_MAX_BP_PER_PX,
    }
    const overlay = Array.from({ length: count }, (_, i) =>
      makeItem({
        startBp: i * cellBp,
        endBp: (i + 1) * cellBp,
        aminoAcid: 'M',
        proteinIndex: firstIndex + i,
        topPx: 0,
        heightPx,
      }),
    )
    const ctx = new SvgCanvas()
    drawPeptides(ctx, makeData(overlay), region)
    // strokeText + fillText emit one <text> each (the halo pattern), so take the
    // fills alone — the stroke is the same string at the same x.
    return [
      ...ctx
        .getSerializedSvg()
        .matchAll(/<text x="([^"]*)"[^>]*>([^<]*)<\/text>/g),
    ]
      .filter((_, i) => i % 2 === 1)
      .map(m => ({ x: Number.parseFloat(m[1]!), text: m[2]! }))
  }

  // 24px cells; textAlign is 'center', so each label occupies
  // [x - w/2, x + w/2] and adjacent labels must not cross.
  function overlaps(painted: { x: number; text: string }[], fontSize = 10) {
    const spans = painted.map(({ x, text }) => {
      const w = measureText(text, fontSize, 'monospace')
      return { left: x - w / 2, right: x + w / 2 }
    })
    return spans.some((s, i) => i > 0 && s.left < spans[i - 1]!.right)
  }

  test('a 1-digit protein fits its letter and number in a 24px codon', () => {
    const painted = paintedTexts(0)
    expect(painted.map(p => p.text)).toEqual([
      'M1',
      'M2',
      'M3',
      'M4',
      'M5',
      'M6',
    ])
    expect(overlaps(painted)).toBe(false)
  })

  // The regression. `M12346` is 36.6px of monospace in a 24px cell: it used to
  // be painted anyway, so a titin CDS drew its residue numbers straight through
  // each other.
  test('a 5-digit protein drops to bare letters rather than colliding', () => {
    const painted = paintedTexts(12345)
    // the assertion that fails on the old fixed-20px rule, which painted
    // `M12346` (36.6px) into a 24px cell
    expect(overlaps(painted)).toBe(false)
    expect(painted.map(p => p.text)).toEqual(['M', 'M', 'M', 'M', 'M', 'M'])
  })

  test('the numbers come back once the cells are wide enough to hold them', () => {
    const cellBp = 3
    const count = 4
    const region: BpRegionBounds = {
      start: 0,
      end: cellBp * count,
      // 4x further in than the threshold: 96px cells, room for `M12346`
      screenStartPx: 0,
      screenEndPx: (cellBp * count * 4) / PEPTIDE_TEXT_MAX_BP_PER_PX,
    }
    const overlay = Array.from({ length: count }, (_, i) =>
      makeItem({
        startBp: i * cellBp,
        endBp: (i + 1) * cellBp,
        proteinIndex: 12345 + i,
        topPx: 0,
        heightPx: 10,
      }),
    )
    const ctx = new SvgCanvas()
    drawPeptides(ctx, makeData(overlay), region)
    expect(ctx.getSerializedSvg()).toContain('>M12346<')
  })
})
