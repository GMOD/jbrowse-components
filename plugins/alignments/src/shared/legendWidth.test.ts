import { measureText } from '@jbrowse/core/util'

import { READ_COLOR_CATEGORY_BY_INDEX } from '../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import { bezierConnectionLegendItems } from '../features/linkedReads/computeOverlay.ts'
import { LINKED_READ_SLOT_CATEGORY } from '../shaders/palettes.ts'
import { COLOR_SCHEMES, isModificationScheme } from './colorSchemes.ts'
import {
  LEGEND_MAX_WIDTH,
  getArcLegendItems,
  getReadDisplayLegendItems,
} from './legendUtils.ts'
import { modificationData } from './modificationData.ts'

import type { ColorBy, ModificationColorBy } from './types.ts'

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

// Every registered scheme, so the per-scheme relabelings (split segments,
// first-of-pair, the tag/mate no-value wording) are measured too and not just
// the base table. Off the registry rather than a list kept here: a hand-kept
// list left `modifications` out, so its rows went unmeasured. The modification
// schemes key different rows per sub-mode (the methylated states, the
// unmodified swatch), so each sub-mode is swept as well.
const MODIFICATION_MODES: (ModificationColorBy | undefined)[] = [
  undefined,
  { twoColor: true },
  { fillUnmarked: true },
]
const COLOR_BYS: ColorBy[] = Object.values(COLOR_SCHEMES).flatMap(({ type }) =>
  isModificationScheme(type)
    ? MODIFICATION_MODES.map(modifications => ({ type, modifications }))
    : [{ type }],
)

// Every bucket at once — not a realistic frame, but the union is what has to
// fit, and asking for it per scheme lets each scheme's overrides through. The
// exhaustive category list, so a new swatch bucket is measured without being
// added here; the dynamic ones (plain/mapq/tag) key no bucket row and are
// harmless in the set.
const ALL = new Set(READ_COLOR_CATEGORY_BY_INDEX)

// Every modification type the name table knows, so each name is measured — and
// a cytosine-only detection, which is the one case that words the blue swatch
// "Unmethylated" rather than "Unmodified".
const DETECTED_MODIFICATIONS = [
  new Map(
    Object.entries(modificationData).map(([type, { color }]) => [type, color]),
  ),
  new Map([['m', modificationData.m!.color]]),
]

// The overlap row is appended by the same builder and is the longest label in
// the vocabulary, so leaving it out of the sweep measured everything except the
// row most likely to overflow. Both wordings, since they differ per layout.
const OVERLAPS = [undefined, 'chain', 'collapsed'] as const

function everyLabel() {
  const out = new Set<string>()
  for (const colorBy of COLOR_BYS) {
    for (const overlaps of OVERLAPS) {
      for (const detectedModifications of DETECTED_MODIFICATIONS) {
        for (const item of getReadDisplayLegendItems({
          colorBy,
          presentCategories: ALL,
          palette: makeTestPalette(),
          detectedModifications,
          overlaps,
        })) {
          out.add(item.label)
        }
      }
    }
  }
  // The overlay's own wording, which lands in the SAME box — merged into the
  // read section or under its own heading, either way against this width.
  // Sweeping only the read builder left the second-widest label in the
  // vocabulary ("Split alignment (interchromosomal)") unmeasured, which is not
  // a width `LEGEND_MAX_WIDTH` can claim to be derived from.
  for (const mode of ['arc', 'cloud'] as const) {
    for (const item of getArcLegendItems(ALL, makeTestPalette(), mode)) {
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

// The rows the hand-kept lists used to miss. A sweep that quietly stops
// reaching a scheme measures nothing for it, so the reach is pinned.
test('the sweep reaches the modification rows', () => {
  expect(everyLabel()).toEqual(
    expect.arrayContaining([
      'Read, forward strand',
      'Read, reverse strand',
      '5mC methylated',
      '5hmC methylated',
      'Unmethylated',
      'Unmodified',
      'inosine',
    ]),
  )
})

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
