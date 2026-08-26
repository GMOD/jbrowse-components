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

  // 3bp codons at 50px. The budget is 7 monospace characters — 42.7px at a 10px
  // row — so the numbers are on. Note the budget is measured against a CODON at
  // this zoom, not against the item's own span, which is why the region rather
  // than the item's width is what decides it.
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

  // 3bp codons at 8px/bp = 24px, the coarsest zoom the letters draw at at all.
  // The budget is 7 monospace characters = 42.7px at a 10px row, so numbers are
  // still off here.
  test('omits the residue number when a codon is narrower than the budget', () => {
    const region: BpRegionBounds = { ...FULL_REGION, start: 0, end: 125 }
    const data = makeData([
      makeItem({ startBp: 0, endBp: 3, aminoAcid: 'M', proteinIndex: 0 }),
    ])
    expect(collect(data, region)[0]!.cell.text).toBe('M')
  })

  // The bug a flat px threshold could not see: at the coarsest zoom the letters
  // draw at (bpPerPx 1/8), a whole codon is 24px, so a 20px threshold said "the
  // number fits" for every residue in the proteome. `M12345` on TTN is six
  // monospace characters — 36.6px at the default 10px row — and ran into both
  // its neighbours.
  test('never numbers residues at a zoom where the number would not fit', () => {
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
    expect(at(0)).toBe('M')
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

// The whole point of the budget rule: what a residue is drawn as depends on the
// ZOOM and nothing else. No protein, no row, no neighbour, and no scroll
// position may change it — that is what makes the overlay uniform instead of
// ragged, and these pin each way it could stop being.
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

  // The region that renders those `count` codons at `cellPx` each.
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

  // The digit count is the thing a per-residue rule keys on, so a run crossing
  // 999 -> 1000 is where it splits. Both zooms answer the same for every residue.
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

  // A 4-residue peptide and titin get the same answer at the same zoom. This is
  // the cost of the rule as much as the point of it: the short one reserved
  // digits it never uses.
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

  // A codon straddling an exon boundary is emitted as two pieces 1-2bp wide.
  // The budget is measured against a FULL codon, so the fragment is numbered
  // like everything else instead of being the one bare letter in the row.
  test('a narrow exon-boundary fragment is numbered like its neighbours', () => {
    const overlay = glyphRun(0, 4)
    overlay[3] = { ...overlay[3]!, endBp: 10 }
    expect(textsOf(overlay, 50)).toEqual(['M1', 'M2', 'M3', 'M4'])
  })

  // Rows and features are not inputs: a titin stacked beside a short peptide
  // leaves it alone, in both directions.
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

// The claim the layout above exists to make, asserted on what is actually
// PAINTED rather than on the numbers feeding it: no residue's text may reach its
// neighbour's, at any zoom, for any protein. Driven through SvgCanvas because it
// records each draw as a `<text x=...>` element — the same 2D-context surface
// the SVG export paints peptides onto, so this covers the export path as well as
// the on-screen one.
describe('drawPeptides never collides two labels', () => {
  // A run of codons tiling the region, numbered from `firstIndex`, at
  // `zoomFactor` times the coarsest zoom the letters draw at.
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

  // textAlign is 'center', so each label occupies [x - w/2, x + w/2] and
  // adjacent labels must not cross.
  function overlaps(painted: { x: number; text: string }[], fontSize = 10) {
    const spans = painted.map(({ x, text }) => {
      const w = measureText(text, fontSize, 'monospace')
      return { left: x - w / 2, right: x + w / 2 }
    })
    return spans.some((s, i) => i > 0 && s.left < spans[i - 1]!.right)
  }

  // At the coarsest zoom that draws letters a codon is 24px, under the 42.7px
  // budget, so nothing is numbered — including the 1-digit protein that would
  // have fit. That is the trade: it reads as a clean row of letters rather than
  // as a row whose numbering depends on which gene you opened.
  test('bare letters at the zoom the letters first appear at', () => {
    for (const firstIndex of [0, 998, 12345]) {
      const painted = paintedTexts(firstIndex)
      expect(painted.map(p => p.text)).toEqual(['M', 'M', 'M', 'M', 'M', 'M'])
      expect(overlaps(painted)).toBe(false)
    }
  })

  // Two zoom steps in, a codon clears the budget and every protein numbers —
  // the 6-character titin label included, which is what the budget reserved for.
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

  // The regression, and the property that has to hold at every zoom rather than
  // at the two sampled above: the old fixed-20px rule painted `M12346` (36.6px)
  // into a 24px cell, so a titin CDS drew its residue numbers through each
  // other. Swept across the zoom range the letters are drawn over.
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

  // The letters are painted into a context a previous painter has already used:
  // the SVG export hands `drawPeptides` the layer it drew highlight boxes and
  // floating labels into. Neither what it inherits nor what it leaves behind may
  // matter — the `y` it computes places an ALPHABETIC baseline, so a 'middle'
  // left over from another painter would slide every letter off the white halo
  // drawn under it, and a `textAlign` left as 'center' would re-anchor whatever
  // paints next.
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

  // Uniformity, at the paint level: a row is all numbered or all bare, never a
  // mix, at every zoom.
  test('a row is never a mix of numbered and bare labels', () => {
    for (const zoomFactor of [1, 1.25, 1.5, 1.75, 2, 3, 5, 8]) {
      // 997..1002 straddles the digit boundary a per-residue rule splits on
      const painted = paintedTexts(997, zoomFactor)
      const numbered = painted.map(p => p.text.length > 1)
      expect(new Set(numbered).size).toBe(1)
    }
  })
})
