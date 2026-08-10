import {
  makeAminoAcidOverlayItem,
  makeFlatbushItem,
  makeSubfeatureInfo,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import { hgvsHitLabel, hoverTooltip, hoverTooltipText } from './hoverReadout.ts'

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
    subfeature: null,
    peptide: null,
    bpPos: 0,
    // base zoom, so the HGVS readout is in play unless a test says otherwise
    bpPerPx: 0.1,
    displayedRegionIndex: 0,
    ...over,
  }
}

test('hoverTooltip falls back to the feature mouseover slot', () => {
  expect(hoverTooltip(makeHit({}))).toBe('gene mouseover')
})

test('hoverTooltip prefers the subfeature label over the feature mouseover', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltip(
      makeHit({ subfeature: { ...sub, displayLabel: 'BRCA1-201' } }),
    ),
  ).toBe('BRCA1-201')
})

test('hoverTooltip puts the residue on its own line under the isoform', () => {
  const sub = makeSub('mRNA1', 'gene1', 0, 100, 0, 20)
  expect(
    hoverTooltip(
      makeHit({
        subfeature: { ...sub, displayLabel: 'BRCA1-201' },
        peptide: makeAa('K', 0, 3, 123),
      }),
    ),
  ).toBe('BRCA1-201<br/>K124')
})

// A hovered letter narrows what the second row says; it doesn't change what
// names the thing under the cursor. With no isoform to name, the feature's own
// mouseover still heads the tooltip — dropping it would leave a bare residue
// with no clue which feature it belongs to.
test('hoverTooltip keeps the feature mouseover above a residue when there is no isoform', () => {
  expect(hoverTooltip(makeHit({ peptide: makeAa('K', 0, 3, 123) }))).toBe(
    'gene mouseover<br/>K124',
  )
})

// The rect is already painted in TRANSL_EXCEPT_HIGHLIGHT, but a color says
// nothing about what it means: `U840` on SELENOP has to read as a deliberate
// selenocysteine rather than as a mistranslated stop.
test('hoverTooltip marks a residue that came from a transl_except override', () => {
  expect(
    hoverTooltip(
      makeHit({
        peptide: { ...makeAa('U', 0, 3, 839), isTranslExcept: true },
      }),
    ),
  ).toBe('gene mouseover<br/>U840 (transl_except)')
})

test('hoverTooltip leaves only the residue for a feature with no tooltip text', () => {
  expect(
    hoverTooltip(
      makeHit({
        feature: { ...makeItem('gene1', 0, 100, 0, 20), tooltip: '' },
        peptide: makeAa('K', 0, 3, 123),
      }),
    ),
  ).toBe('K124')
})

// Three exons at 0-10, 20-30, 40-50, coding 5-45, on the + strand: c.1 is
// genomic 5, and each exon contributes 10 transcribed bases.
const CODING_TRANSCRIPT: TranscriptCoords = {
  exons: [0, 10, 20, 30, 40, 50],
  strand: 1,
  coding: [5, 45],
}

const isoformHit = (over: Partial<HitFeatureResult>) =>
  makeHit({
    subfeature: {
      ...makeSub('mRNA1', 'gene1', 0, 100, 0, 20),
      displayLabel: 'BRCA1-201',
      transcript: CODING_TRANSCRIPT,
    },
    ...over,
  })

test('hoverTooltip names the exon under the cursor, on a line under the isoform', () => {
  const at = (bpPos: number) => hoverTooltip(isoformHit({ bpPos }))
  expect(at(5)).toBe('BRCA1-201<br/>exon 1/3 c.1')
  expect(at(25)).toBe('BRCA1-201<br/>exon 2/3 c.11')
  expect(at(45)).toBe('BRCA1-201<br/>exon 3/3 c.*1')
  // an intron names no exon -- the c. offset already says which boundary it is
  // past, and "exon 2" would read as though the cursor were inside one. The
  // offset is measured from whichever exon is nearer, so the 10bp intron at
  // 10..19 reads +n in its first half and -n in its second.
  expect(at(11)).toBe('BRCA1-201<br/>c.5+2')
  expect(at(18)).toBe('BRCA1-201<br/>c.6-2')
})

test('hoverTooltip reads the transcript off the feature when it stands alone', () => {
  expect(
    hoverTooltip(
      makeHit({
        feature: {
          ...makeItem('mRNA1', 0, 100, 0, 20),
          tooltip: 'mRNA mouseover',
          transcript: CODING_TRANSCRIPT,
        },
        bpPos: 25,
      }),
    ),
  ).toBe('mRNA mouseover<br/>exon 2/3 c.11')
})

test('hoverTooltip keeps exon and HGVS alongside a hovered residue, on the second line', () => {
  expect(
    hoverTooltip(isoformHit({ peptide: makeAa('K', 0, 3, 123), bpPos: 25 })),
  ).toBe('BRCA1-201<br/>exon 2/3 c.11 K124')
})

// Zoomed out, the cursor covers many bases at once, so a position reported to
// the base would be silently wrong. The exon is still safe to name.
test('hoverTooltip drops the HGVS position below base zoom', () => {
  expect(hoverTooltip(isoformHit({ bpPos: 25, bpPerPx: 10 }))).toBe(
    'BRCA1-201<br/>exon 2/3',
  )
})

test('hoverTooltipText joins rows on a real newline instead of <br/>', () => {
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

test('hoverTooltip says nothing extra for a single-exon transcript', () => {
  expect(
    hoverTooltip(
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
  ).toBe('SOX2-201<br/>c.21')
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
})
