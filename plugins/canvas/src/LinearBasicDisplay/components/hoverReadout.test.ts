import {
  makeAminoAcidOverlayItem,
  makeFlatbushItem,
  makeSubfeatureInfo,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import {
  hgvsHitLabel,
  hoverTooltipRows,
  hoverTooltipText,
} from './hoverReadout.ts'

import type { TranscriptCoords } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { HitFeatureResult } from './hitTesting.ts'

// What a hit SAYS, with no Flatbush in sight: every case here builds a
// HitFeatureResult by hand and asserts on a string, which is the whole reason
// these live apart from hitTesting.test.ts (how a hit is FOUND).

const makeItem = (
  featureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
) =>
  makeFlatbushItem({
    featureId,
    startBp,
    endBp,
    topPx,
    bottomPx,
    featureHeightPx: bottomPx - topPx,
  })

const makeSub = (
  featureId: string,
  parentFeatureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
) =>
  makeSubfeatureInfo({
    featureId,
    parentFeatureId,
    startBp,
    endBp,
    topPx,
    bottomPx,
  })

const makeAa = (
  aminoAcid: string,
  startBp: number,
  endBp: number,
  proteinIndex: number,
) => makeAminoAcidOverlayItem({ aminoAcid, startBp, endBp, proteinIndex })

function makeHit(over: Partial<HitFeatureResult>): HitFeatureResult {
  return {
    feature: { ...makeItem('gene1', 0, 100, 0, 20), tooltip: 'gene mouseover' },
    subfeature: undefined,
    peptide: undefined,
    bpPos: 0,
    // base zoom, so the HGVS readout is in play unless a test says otherwise
    bpPerPx: 0.1,
    displayedRegionIndex: 0,
    ...over,
  }
}

test('hoverTooltipRows falls back to the feature mouseover slot', () => {
  expect(hoverTooltipRows(makeHit({}))).toEqual(['gene mouseover'])
})

test('hoverTooltipRows prefers the subfeature label over the feature mouseover', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltipRows(
      makeHit({ subfeature: { ...sub, displayLabel: 'BRCA1-201' } }),
    ),
  ).toEqual(['BRCA1-201'])
})

// A transcript names itself and nothing else — `NM_004006.2` under the cursor
// says nothing about DMD, whose floating label the fit ladder may have trimmed.
test('hoverTooltipRows names the parent gene above the isoform', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltipRows(
      makeHit({
        feature: {
          ...makeItem('gene1', 0, 100, 0, 20),
          tooltip: 'x',
          name: 'BRCA1',
        },
        subfeature: { ...sub, displayLabel: 'BRCA1-201' },
      }),
    ),
  ).toEqual(['BRCA1', 'BRCA1-201'])
})

// A single-transcript annotation regularly labels the child with the gene's own
// name, and `BRCA1` over `BRCA1` is a row that says nothing.
test('hoverTooltipRows drops the gene row when the isoform repeats the name', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltipRows(
      makeHit({
        feature: {
          ...makeItem('gene1', 0, 100, 0, 20),
          tooltip: 'x',
          name: 'BRCA1',
        },
        subfeature: { ...sub, displayLabel: 'BRCA1' },
      }),
    ),
  ).toEqual(['BRCA1'])
})

// Hovering the gene body itself, the mouseover slot already names it; the drawn
// name has nothing to add above it.
test('hoverTooltipRows adds no gene row without an isoform under the cursor', () => {
  expect(
    hoverTooltipRows(
      makeHit({
        feature: {
          ...makeItem('gene1', 0, 100, 0, 20),
          tooltip: 'gene mouseover',
          name: 'BRCA1',
        },
      }),
    ),
  ).toEqual(['gene mouseover'])
})

test('hoverTooltipRows puts the residue on its own line under the isoform', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltipRows(
      makeHit({
        subfeature: { ...sub, displayLabel: 'BRCA1-201' },
        peptide: makeAa('K', 0, 3, 123),
      }),
    ),
  ).toEqual(['BRCA1-201', 'K124'])
})

// A hovered letter narrows what the second row says; it doesn't change what
// names the thing under the cursor. With no isoform to name, the feature's own
// mouseover still heads the tooltip — dropping it would leave a bare residue
// with no clue which feature it belongs to.
test('hoverTooltipRows keeps the feature mouseover above a residue when there is no isoform', () => {
  expect(
    hoverTooltipRows(makeHit({ peptide: makeAa('K', 0, 3, 123) })),
  ).toEqual(['gene mouseover', 'K124'])
})

// The rect is already painted in TRANSL_EXCEPT_HIGHLIGHT, but a color says
// nothing about what it means: `U840` on SELENOP has to read as a deliberate
// selenocysteine rather than as a mistranslated stop.
test('hoverTooltipRows marks a residue that came from a transl_except override', () => {
  expect(
    hoverTooltipRows(
      makeHit({
        peptide: { ...makeAa('U', 0, 3, 839), isTranslExcept: true },
      }),
    ),
  ).toEqual(['gene mouseover', 'U840 (transl_except)'])
})

test('hoverTooltipRows leaves only the residue for a feature with no tooltip text', () => {
  expect(
    hoverTooltipRows(
      makeHit({
        feature: { ...makeItem('gene1', 0, 100, 0, 20), tooltip: '' },
        peptide: makeAa('K', 0, 3, 123),
      }),
    ),
  ).toEqual(['K124'])
})

// A hover on a floating label arrives as a hit with no subfeature and no
// peptide (see labelHit). A feature whose mouseover slot is empty then has
// nothing to say, and says nothing — not an empty row.
test('hoverTooltipRows drops the empty title row of a label-shaped hit', () => {
  expect(
    hoverTooltipRows(
      makeHit({
        feature: { ...makeItem('gene1', 0, 100, 0, 20), tooltip: '' },
      }),
    ),
  ).toEqual([])
})

// Three exons at 0-10, 20-30, 40-50, coding 5-45, on the + strand: c.1 is
// genomic 5, and each exon contributes 10 transcribed bases.
const CODING_TRANSCRIPT: TranscriptCoords = {
  exons: [0, 10, 20, 30, 40, 50],
  strand: 1,
  coding: [5, 45],
}

// The gene the isoform hangs off, named as the display drew it.
const geneItem = (name: string) => ({
  ...makeItem('gene1', 0, 100, 0, 20),
  tooltip: 'gene mouseover',
  name,
})

const isoformHit = (over: Partial<HitFeatureResult>) =>
  makeHit({
    subfeature: {
      ...makeSub('mRNA1', 'gene1', 0, 100, 0, 20),
      displayLabel: 'BRCA1-201',
      transcript: CODING_TRANSCRIPT,
    },
    ...over,
  })

test('hoverTooltipRows names the exon under the cursor, on a line under the isoform', () => {
  const at = (bpPos: number) => hoverTooltipRows(isoformHit({ bpPos }))
  expect(at(5)).toEqual(['BRCA1-201', 'exon 1/3 c.1'])
  expect(at(25)).toEqual(['BRCA1-201', 'exon 2/3 c.11'])
  expect(at(45)).toEqual(['BRCA1-201', 'exon 3/3 c.*1'])
  // an intron names no exon -- the c. offset already says which boundary it is
  // past, and "exon 2" would read as though the cursor were inside one. The
  // offset is measured from whichever exon is nearer, so the 10bp intron at
  // 10..19 reads +n in its first half and -n in its second.
  expect(at(11)).toEqual(['BRCA1-201', 'c.5+2'])
  expect(at(18)).toEqual(['BRCA1-201', 'c.6-2'])
})

test('hoverTooltipRows reads the transcript off the feature when it stands alone', () => {
  expect(
    hoverTooltipRows(
      makeHit({
        feature: {
          ...makeItem('mRNA1', 0, 100, 0, 20),
          tooltip: 'mRNA mouseover',
          transcript: CODING_TRANSCRIPT,
        },
        bpPos: 25,
      }),
    ),
  ).toEqual(['mRNA mouseover', 'exon 2/3 c.11'])
})

test('hoverTooltipRows keeps exon and HGVS alongside a hovered residue, on the second line', () => {
  expect(
    hoverTooltipRows(
      isoformHit({ peptide: makeAa('K', 0, 3, 123), bpPos: 25 }),
    ),
  ).toEqual(['BRCA1-201', 'exon 2/3 c.11 K124'])
})

// Zoomed out, the cursor covers many bases at once, so a position reported to
// the base would be silently wrong. The exon is still safe to name.
test('hoverTooltipRows drops the HGVS position below base zoom', () => {
  expect(hoverTooltipRows(isoformHit({ bpPos: 25, bpPerPx: 10 }))).toEqual([
    'BRCA1-201',
    'exon 2/3',
  ])
})

test('hoverTooltipText joins the rows on a real newline', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltipText(
      makeHit({
        subfeature: { ...sub, displayLabel: 'BRCA1-201' },
        peptide: makeAa('K', 0, 3, 123),
      }),
    ),
  ).toBe('BRCA1-201\nK124')
})

// The mouseover config expression can return HTML (SanitizedHTML renders it
// on-screen) — the clipboard copy should carry the reader's words, not the
// markup around them.
test('hoverTooltipText strips markup from the feature mouseover slot', () => {
  expect(
    hoverTooltipText(
      makeHit({
        feature: {
          ...makeItem('gene1', 0, 100, 0, 20),
          tooltip: '<b>gene</b> mouseover',
        },
      }),
    ),
  ).toBe('gene mouseover')
})

// `<DEL>`, `<INS>` and friends are VCF alleles, not markup — SanitizedHTML
// escapes them and shows them whole, so the clipboard has to carry them whole
// too. Parsing every row as HTML copied this one as `ALT `.
test('hoverTooltipText keeps angle-bracket text that is not markup', () => {
  expect(
    hoverTooltipText(
      makeHit({
        feature: {
          ...makeItem('var1', 0, 100, 0, 20),
          tooltip: 'ALT <DEL>',
        },
      }),
    ),
  ).toBe('ALT <DEL>')
})

// Joining fields with <br/> is the standard mouseover idiom; textContent alone
// would collapse them into one run-on line on the clipboard.
test('hoverTooltipText turns <br/> inside the mouseover slot into newlines', () => {
  expect(
    hoverTooltipText(
      makeHit({
        feature: {
          ...makeItem('gene1', 0, 100, 0, 20),
          tooltip: 'Name: BRCA1<br/>Type: gene<br>Score: 12',
        },
      }),
    ),
  ).toBe('Name: BRCA1\nType: gene\nScore: 12')
})

test('hoverTooltipRows says nothing extra for a single-exon transcript', () => {
  expect(
    hoverTooltipRows(
      isoformHit({
        subfeature: {
          ...makeSub('mRNA1', 'gene1', 0, 100, 0, 20),
          displayLabel: 'SOX2-201',
          transcript: { exons: [0, 50], strand: 1, coding: [5, 45] },
        },
        bpPos: 25,
      }),
    ),
    // "exon 1/1" is noise; the coordinate still carries
  ).toEqual(['SOX2-201', 'c.21'])
})

describe('hgvsHitLabel', () => {
  it('prefixes the coordinate with the transcript accession', () => {
    expect(hgvsHitLabel(isoformHit({ bpPos: 25 }))).toBe('BRCA1-201:c.11')
  })

  it('falls back to the bare coordinate for an unnamed transcript', () => {
    expect(
      hgvsHitLabel(
        makeHit({
          feature: {
            ...makeItem('mRNA1', 0, 100, 0, 20),
            transcript: CODING_TRANSCRIPT,
          },
          bpPos: 25,
        }),
      ),
    ).toBe('c.11')
  })

  it('offers nothing below base zoom, or off a transcript', () => {
    expect(hgvsHitLabel(isoformHit({ bpPos: 25, bpPerPx: 10 }))).toBeUndefined()
    expect(hgvsHitLabel(makeHit({ bpPos: 25 }))).toBeUndefined()
  })

  // A subfeature registered by a non-transcript glyph (mature-peptide product,
  // repeat subpart, a bare exon row stacked beside a gene's transcripts) has a
  // displayLabel but no transcript of its own, so the coordinate falls back to
  // the parent's. Taking the name off the subfeature anyway produced
  // `exon5:n.123` — one thing's label on another thing's coordinate system, in
  // the syntax a clinical variant is reported in.
  it('names the transcript the coordinate was measured on, not an unrelated subfeature', () => {
    expect(
      hgvsHitLabel(
        makeHit({
          feature: {
            ...makeItem('mRNA1', 0, 100, 0, 20),
            name: 'BRCA1-201',
            transcript: CODING_TRANSCRIPT,
          },
          subfeature: {
            ...makeSub('exon5', 'mRNA1', 20, 30, 0, 20),
            displayLabel: 'exon5',
          },
          bpPos: 25,
        }),
      ),
    ).toBe('BRCA1-201:c.11')
  })

  // `NM_004006.2(DMD):c.93+1` is the nomenclature's own reference form, and what
  // ClinVar and LOVD take -- an accession alone leaves the reader to look up
  // which gene it transcribes.
  it('parenthesizes the gene the transcript was read off', () => {
    expect(
      hgvsHitLabel(isoformHit({ feature: geneItem('BRCA1'), bpPos: 25 })),
    ).toBe('BRCA1-201(BRCA1):c.11')
  })

  // The container of a mature-peptide or repeat-subpart hit is not a gene, and
  // its accession inside those brackets would read as a gene symbol.
  it('parenthesizes nothing for a container that is not a gene', () => {
    expect(
      hgvsHitLabel(
        isoformHit({
          feature: { ...geneItem('POLG-201'), type: 'mRNA' },
          bpPos: 25,
        }),
      ),
    ).toBe('BRCA1-201:c.11')
  })

  it('parenthesizes nothing when the gene and the transcript share a name', () => {
    expect(
      hgvsHitLabel(isoformHit({ feature: geneItem('BRCA1-201'), bpPos: 25 })),
    ).toBe('BRCA1-201:c.11')
  })
})
