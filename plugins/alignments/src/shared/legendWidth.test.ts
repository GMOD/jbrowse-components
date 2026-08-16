import { measureText } from '@jbrowse/core/util'

import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import { bezierConnectionLegendItems } from '../features/linkedReads/computeOverlay.ts'
import { LINKED_READ_SLOT_CATEGORY } from '../shaders/palettes.ts'
import {
  LEGEND_MAX_WIDTH,
  getArcLegendItems,
  getReadDisplayLegendItems,
} from './legendUtils.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ColorSchemeType } from './types.ts'

// FloatingLegend's own geometry, which decides how much of `LEGEND_MAX_WIDTH` a
// label actually gets: 1px border either side, 3px left padding, the 20px
// right-hand gutter the dismiss "×" reserves (`withClose`, always on for this
// display), and the swatch column — 12px per mark plus 2px between, and 6px
// before the text.
const BORDERS = 2
const PADDING_LEFT = 3
const DISMISS_GUTTER = 20
const swatchColumn = (marks: number) => marks * 12 + (marks - 1) * 2 + 6

// measureText reads a Helvetica table; the app renders Roboto, which is wider.
// The same 1.1 correction measureLegendText applies for the SVG export.
const APP_FONT = 1.1
const labelWidth = (label: string) => measureText(label, 10) * APP_FONT

const budget = (marks: number) =>
  LEGEND_MAX_WIDTH -
  BORDERS -
  PADDING_LEFT -
  DISMISS_GUTTER -
  swatchColumn(marks)

// Every scheme, so the per-scheme relabelings (split segments, first-of-pair,
// the tag/mate no-value wording) are measured too and not just the base table.
const SCHEMES: ColorSchemeType[] = [
  'normal',
  'strand',
  'firstOfPairStrand',
  'insertSize',
  'insertSizeAndOrientation',
  'pairOrientation',
  'mappingQuality',
  'perBaseQuality',
  'perBaseLetter',
  'tag',
  'mateRefName',
]

// Every fixed-swatch bucket at once — not a realistic frame, but the union is
// what has to fit, and asking for it per scheme lets each scheme's overrides
// through.
const ALL: ReadColorCategory[] = [
  'fwdStrand',
  'revStrand',
  'noStrand',
  'nonSplit',
  'pairLR',
  'pairRL',
  'pairLL',
  'pairRR',
  'normalInsert',
  'longInsert',
  'shortInsert',
  'splitInversion',
  'splitDeletion',
  'interchrom',
  'unmappedMate',
  'supplementary',
  'mapqUnavailable',
  'noTagValue',
]

// The overlap row is appended by the same builder and is the longest label in
// the vocabulary, so leaving it out of the sweep measured everything except the
// row most likely to overflow. Both wordings, since they differ per layout.
const OVERLAPS = [undefined, 'chain', 'collapsed'] as const

function everyLabel() {
  const out = new Set<string>()
  for (const type of SCHEMES) {
    for (const overlaps of OVERLAPS) {
      for (const item of getReadDisplayLegendItems({
        colorBy: { type },
        presentCategories: new Set(ALL),
        palette: makeTestPalette(),
        detectedModifications: new Map([['m', 'red']]),
        overlaps,
      })) {
        out.add(item.label)
      }
    }
  }
  // The overlay's own wording, which lands in the SAME box — merged into the
  // read section or under its own heading, either way against this width.
  // Sweeping only the read builder left the second-widest label in the
  // vocabulary ("Split alignment (interchromosomal)") unmeasured, which is not
  // a width `LEGEND_MAX_WIDTH` can claim to be derived from.
  for (const mode of ['arc', 'cloud'] as const) {
    for (const item of getArcLegendItems(
      new Set(ALL),
      makeTestPalette(),
      mode,
    )) {
      out.add(item.label)
    }
  }
  // …and the connection curves', which is a third table again
  // (`connectionLabel`, whose neutral fallback no other builder produces).
  for (const item of bezierConnectionLegendItems(
    LINKED_READ_SLOT_CATEGORY.keys(),
    makeTestPalette(),
  )) {
    out.add(item.label)
  }
  return [...out]
}

// The box floats over the data and ellipsizes what it can't fit, so a label that
// outgrows it does not fail loudly — it silently loses its tail, which for this
// vocabulary is the informative half ("Split paired-end read (same stra…").
// Measuring here is what makes `LEGEND_MAX_WIDTH` a derived number rather than a
// guess that rots the next time a label is reworded.
test('every read-legend label fits the width this display asks for', () => {
  const tooWide = everyLabel().filter(l => labelWidth(l) > budget(1))
  expect(tooWide).toEqual([])
})

// A row carrying two marks (one bucket the fills and the curves paint in
// different colors) spends 14 more px on swatches, so it is the tighter case.
test('…including on a row that has grown a second mark', () => {
  const tooWide = everyLabel().filter(l => labelWidth(l) > budget(2))
  expect(tooWide).toEqual([])
})

// The width is meant to be sized to the labels, not padded well past them — a
// legend that reserves more of the track than its text needs is occlusion for
// nothing. If this fails low, shrink LEGEND_MAX_WIDTH toward the longest label.
test('and the width is not more than the longest label needs', () => {
  const longest = Math.max(...everyLabel().map(labelWidth))
  expect(budget(2) - longest).toBeLessThan(30)
})
