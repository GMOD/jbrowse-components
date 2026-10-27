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

// Maps bp 1:1 to px, so a cell's centerPx is the midpoint of its bp span.
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

  // 3bp codons at 50px, over the 42.7px budget. The budget measures a CODON at
  // this zoom rather than the item's own span, so the region decides it.
  test('appends the residue number when a codon has room for the budget', () => {
    const region: BpRegionBounds = {
      start: 0,
      end: 30,
      screenStartPx: 0,
      screenEndPx: 500,
    }
    const data = makeData([
      makeItem({ startBp: 0, endBp: 3, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, region)[0]!.cell.text).toBe('M1')
  })

  // 3bp codons at 24px, the coarsest zoom the letters draw at, under the 42.7px
  // budget.
  test('omits the residue number when a codon is narrower than the budget', () => {
    const region: BpRegionBounds = { ...FULL_REGION, start: 0, end: 125 }
    const data = makeData([
      makeItem({ startBp: 0, endBp: 3, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, region)[0]!.cell.text).toBe('M')
  })

  // `M12345` on TTN is 36.6px at a 10px row, so a flat 20px threshold would run
  // it into both neighbours at the coarsest zoom the letters draw at.
  test('never numbers residues at a zoom where the number would not fit', () => {
    // 24px, the tightest cell that ever draws text.
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
    expect(at(0)).toBe('M')
    expect(at(34349)).toBe('M')
  })

  // superCompact scales a default 10px feature's letters to 3px.
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
    // Reversed maps bp b -> 1000 - b, so 100..130 -> 900..870, midpoint 885.
    expect(emitted!.cell.centerPx).toBe(885)
  })
})

// What a residue draws as depends on the zoom and nothing else: no protein, no
// row, no neighbour, no scroll position, which is what keeps the overlay uniform
// rather than ragged.
describe('residue numbers depend on zoom alone', () => {
  // A run of `count` 3bp codons on one row, numbered from `firstIndex`.
  function glyphRun(
    firstIndex: number,
    count: number,
    over: Partial<AminoAcidOverlayItem> = {},
  ) {
    return Array.from({ length: count }, (_, i) =>
      makeItem({
        startBp: i * 3,
        endBp: (i + 1) * 3,
        aminoAcid: 'M',
        proteinIndex: firstIndex + i,
        topPx: 0,
        heightPx: 10,
        ...over,
      }),
    )
  }

  const regionFor = (count: number, cellPx: number): BpRegionBounds => ({
    start: 0,
    end: count * 3,
    screenStartPx: 0,
    screenEndPx: count * cellPx,
  })

  const textsOf = (overlay: AminoAcidOverlayItem[], cellPx: number) =>
    collect(makeData(overlay), regionFor(overlay.length, cellPx)).map(
      e => e.cell.text,
    )

  // A per-residue rule keys on the digit count, so a run crossing 999 -> 1000 is
  // where it would split.
  test('a run crossing the 999 -> 1000 digit boundary is uniform', () => {
    expect(textsOf(glyphRun(997, 6), 30)).toEqual([
      'M',
      'M',
      'M',
      'M',
      'M',
      'M',
    ])
    expect(textsOf(glyphRun(997, 6), 50)).toEqual([
      'M998',
      'M999',
      'M1000',
      'M1001',
      'M1002',
      'M1003',
    ])
  })

  // The cost of the rule as much as its point: the short protein reserves digits
  // it never uses.
  test('a short protein and a long one answer identically', () => {
    expect(textsOf(glyphRun(0, 4), 30)).toEqual(['M', 'M', 'M', 'M'])
    expect(textsOf(glyphRun(34346, 4), 30)).toEqual(['M', 'M', 'M', 'M'])
    expect(textsOf(glyphRun(0, 4), 50)).toEqual(['M1', 'M2', 'M3', 'M4'])
    expect(textsOf(glyphRun(34346, 4), 50)).toEqual([
      'M34347',
      'M34348',
      'M34349',
      'M34350',
    ])
  })

  // A codon straddling an exon boundary emits as two pieces 1-2bp wide, and the
  // budget measures a full codon, so the fragment numbers like its neighbours.
  test('a narrow exon-boundary fragment is numbered like its neighbours', () => {
    const overlay = glyphRun(0, 4)
    overlay[3] = { ...overlay[3]!, endBp: 10 }
    expect(textsOf(overlay, 50)).toEqual(['M1', 'M2', 'M3', 'M4'])
  })

  test('neither the row nor the feature beside it changes the answer', () => {
    const short = glyphRun(0, 4)
    const otherRow = glyphRun(34346, 4, { topPx: 40 })
    const otherFeature = glyphRun(34346, 4, { flatbushIdx: 1 })
    expect(textsOf([...short, ...otherRow], 50).slice(0, 4)).toEqual([
      'M1',
      'M2',
      'M3',
      'M4',
    ])
    expect(textsOf([...short, ...otherFeature], 50).slice(0, 4)).toEqual([
      'M1',
      'M2',
      'M3',
      'M4',
    ])
  })
})

// Driven through SvgCanvas because it records each draw as a `<text x=...>`
// element, which also makes this the export path's coverage.
describe('drawPeptides never collides two labels', () => {
  // Codons tiling the region at `zoomFactor` times the coarsest zoom the letters
  // draw at.
  function paintedTexts(firstIndex: number, zoomFactor = 1, count = 6) {
    const cellBp = 3
    const region: BpRegionBounds = {
      start: 0,
      end: cellBp * count,
      screenStartPx: 0,
      screenEndPx: (cellBp * count * zoomFactor) / PEPTIDE_TEXT_MAX_BP_PER_PX,
    }
    const overlay = Array.from({ length: count }, (_, i) =>
      makeItem({
        startBp: i * cellBp,
        endBp: (i + 1) * cellBp,
        aminoAcid: 'M',
        proteinIndex: firstIndex + i,
        topPx: 0,
        heightPx: 10,
      }),
    )
    const ctx = new SvgCanvas()
    drawPeptides(ctx, makeData(overlay), region)
    // strokeText and fillText emit one <text> each for the halo, so take the fills
    // alone.
    return [
      ...ctx
        .getSerializedSvg()
        .matchAll(/<text x="([^"]*)"[^>]*>([^<]*)<\/text>/g),
    ]
      .filter((_, i) => i % 2 === 1)
      .map(m => ({ x: Number.parseFloat(m[1]!), text: m[2]! }))
  }

  // textAlign is 'center', so each label occupies [x - w/2, x + w/2].
  function overlaps(painted: { x: number; text: string }[], fontSize = 10) {
    const spans = painted.map(({ x, text }) => {
      const w = measureText(text, fontSize, 'monospace')
      return { left: x - w / 2, right: x + w / 2 }
    })
    return spans.some((s, i) => i > 0 && s.left < spans[i - 1]!.right)
  }

  // Nothing is numbered here, the 1-digit protein that would have fit included:
  // the trade is a clean row of letters over one whose numbering depends on which
  // gene you opened.
  test('bare letters at the zoom the letters first appear at', () => {
    for (const firstIndex of [0, 998, 12345]) {
      const painted = paintedTexts(firstIndex)
      expect(painted.map(p => p.text)).toEqual(['M', 'M', 'M', 'M', 'M', 'M'])
      expect(overlaps(painted)).toBe(false)
    }
  })

  test('every protein numbers together once a codon clears the budget', () => {
    expect(paintedTexts(0, 2).map(p => p.text)).toEqual([
      'M1',
      'M2',
      'M3',
      'M4',
      'M5',
      'M6',
    ])
    expect(paintedTexts(34344, 2).map(p => p.text)).toEqual([
      'M34345',
      'M34346',
      'M34347',
      'M34348',
      'M34349',
      'M34350',
    ])
  })

  test('nothing collides at any zoom, for any protein', () => {
    for (const zoomFactor of [1, 1.25, 1.5, 1.75, 2, 3, 5, 8]) {
      for (const firstIndex of [0, 98, 998, 9998, 34344]) {
        const painted = paintedTexts(firstIndex, zoomFactor)
        expect({ zoomFactor, firstIndex, overlaps: overlaps(painted) }).toEqual(
          {
            zoomFactor,
            firstIndex,
            overlaps: false,
          },
        )
      }
    }
  })

  // The SVG export hands `drawPeptides` a layer other painters have already used:
  // an inherited 'middle' baseline would slide every letter off its halo, and a
  // 'center' textAlign left behind would re-anchor whatever paints next.
  test('paints the same letters whatever state it inherits, and hands it back', () => {
    const region: BpRegionBounds = { ...FULL_REGION, start: 0, end: 125 }
    const overlay = [makeItem({ startBp: 0, endBp: 3 })]

    const clean = new SvgCanvas()
    drawPeptides(clean, makeData(overlay), region)

    const dirty = new SvgCanvas()
    dirty.textBaseline = 'middle'
    dirty.textAlign = 'right'
    dirty.font = '30px serif'
    dirty.fillStyle = 'magenta'
    drawPeptides(dirty, makeData(overlay), region)

    expect(dirty.getSerializedSvg()).toBe(clean.getSerializedSvg())
    expect({
      textBaseline: dirty.textBaseline,
      textAlign: dirty.textAlign,
      font: dirty.font,
      fillStyle: dirty.fillStyle,
    }).toEqual({
      textBaseline: 'middle',
      textAlign: 'right',
      font: '30px serif',
      fillStyle: 'magenta',
    })
  })

  test('a row is never a mix of numbered and bare labels', () => {
    for (const zoomFactor of [1, 1.25, 1.5, 1.75, 2, 3, 5, 8]) {
      // 997..1002 straddles the digit boundary a per-residue rule splits on.
      const painted = paintedTexts(997, zoomFactor)
      const numbered = painted.map(p => p.text.length > 1)
      expect(new Set(numbered).size).toBe(1)
    }
  })
})
