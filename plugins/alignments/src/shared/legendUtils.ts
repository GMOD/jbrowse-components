// the leaf module, not the `@jbrowse/core/ui` barrel the types come from: this
// file is reached from the display's state model, which a plugin evaluates at
// install time, and a value import of the barrel would put ~80 Material
// components on every host's first paint (see EAGER_BUNDLE.md)
import { legendSwatches } from '@jbrowse/core/ui/legendSpec'
import {
  colorShortInsertArc,
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/palette'

import {
  categorySwatchColor,
  rgb255,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import { isModificationScheme } from './colorSchemes.ts'
import { getModificationName } from './modificationData.ts'
import {
  isModificationTypeVisible,
  paintsUnmodifiedState,
  usesMethylationLegend,
} from './types.ts'

import type {
  ReadColorCategory,
  SwatchCategory,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ReadConnectionsMode } from '../LinearAlignmentsDisplay/constants.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { ColorBy, ColorSchemeType } from './types.ts'
import type {
  LegendItem,
  LegendMark,
  LegendSection,
  LegendSwatch,
} from '@jbrowse/core/ui'

export type { LegendItem } from '@jbrowse/core/ui'

// One row per color AND one row per label. A swatch means one thing in a legend
// box, so a color that two vocabularies both produce is keyed once, under the
// first label it got — the arcs' neutral slot and the reads' LR slot are both
// `colorPairLR`, and "Normal" listed under "LR - Normal pair orientation" is the
// same grey twice.
//
// The label rule covers the mirror case, and it is where a row grows a SECOND
// mark rather than losing one: short insert is the bucket the reads and the arc
// curves paint in *different* colors (pale fill vs. saturated stroke), so keying
// by color alone lists "Short insert" twice, while keying by label alone drops
// whichever color arrived second — off a box whose whole claim is that it names
// every color drawn. Keeping both as marks on one row is the only form that is
// neither repetitive nor a lie. The reads' swatch leads, since a pileup fill is
// what most of the frame shows.
//
// Color-less rows (headings, notes) merge by label only, never by color.
function oneRowPerMeaning(items: LegendItem[]): LegendItem[] {
  const rows: { item: LegendItem; swatches: LegendSwatch[] }[] = []
  const byColor = new Map<string, number>()
  const byLabel = new Map<string, number>()
  for (const item of items) {
    const at =
      (item.color === undefined ? undefined : byColor.get(item.color)) ??
      byLabel.get(item.label)
    if (at === undefined) {
      byLabel.set(item.label, rows.length)
      if (item.color !== undefined) {
        byColor.set(item.color, rows.length)
      }
      rows.push({ item, swatches: legendSwatches(item) })
    } else if (item.color !== undefined) {
      const row = rows[at]!
      if (!row.swatches.some(s => s.color === item.color)) {
        row.swatches.push({ color: item.color, mark: item.mark })
      }
      // so a third row in this color joins the same one rather than opening its
      // own under the label it happens to carry
      if (!byColor.has(item.color)) {
        byColor.set(item.color, at)
      }
    }
  }
  return rows.map(({ item, swatches }) =>
    swatches.length > 1 ? { ...item, swatches } : item,
  )
}

// "Arc colors" -> "Read and arc colors", keeping whatever noun the overlay
// chose for itself.
function mergedTitle(arcTitle: string) {
  return `Read and ${arcTitle.charAt(0).toLowerCase()}${arcTitle.slice(1)}`
}

/**
 * The display's color vocabularies as legend sections: the read fills, the
 * paired-end arc / read-cloud colors, and the linked-read connection curves.
 * The on-screen `FloatingLegend` and the SVG export both build from this one
 * list, so a heading can't appear in one and not the other. Empty sections drop
 * out and titles only appear once more than one survives, so a plain track still
 * shows a single untitled list.
 *
 * Reads and arcs are **one** section whenever they share a color, which is the
 * usual case: both classify pairs, and a shared bucket is the same swatch on
 * both sides. Splitting them there is a false choice between two bad lists — key
 * both fully and the same four swatches appear under two headings, or subtract
 * the shared ones and "Arc colors" lists three colors for arcs that are drawn in
 * seven. Merged and deduped, every drawn color appears exactly once, which is
 * also the most compact form.
 *
 * They stay separate only when the two genuinely disagree (reads by
 * modification, arcs by insert size): no color is then shared, so neither
 * failure is available and the headings say something real.
 */
export function getAlignmentsLegendSections(model: {
  legendItems: () => LegendItem[]
  arcLegendTitle: string
  arcLegendItems: () => LegendItem[]
  bezierLegendItems: () => LegendItem[]
}): LegendSection[] {
  const reads = model.legendItems()
  const arcs = model.arcLegendItems()
  // Color-less rows (headings, notes) never count as a shared color — a `reads`
  // and an `arcs` entry that both omit `color` would otherwise both land on
  // `undefined` and read as a match, merging two sections that share no swatch.
  const readColors = new Set(
    reads.map(i => i.color).filter(c => c !== undefined),
  )
  const merge = arcs.some(a => a.color !== undefined && readColors.has(a.color))
  return [
    merge
      ? {
          id: 'reads',
          title: mergedTitle(model.arcLegendTitle),
          items: oneRowPerMeaning([...reads, ...arcs]),
        }
      : { id: 'reads', title: 'Read colors', items: reads },
    {
      id: 'arcs',
      title: model.arcLegendTitle,
      items: merge ? [] : arcs,
    },
    {
      id: 'connections',
      title: 'Read connections',
      items: model.bezierLegendItems(),
    },
  ]
}

function hslRamp(
  saturation: number,
  steps: { hue: number; label: string }[],
): LegendItem[] {
  return steps.map(({ hue, label }) => ({
    color: `hsl(${hue}, ${saturation}%, 50%)`,
    label,
  }))
}

// The label for each fixed-swatch category, in display order — object key order
// is the order, the same way `GROUP_BY_DIMENSIONS`' is its menu order. The
// swatch color is resolved from the live palette (categorySwatchColor), so
// wording is the only thing the legend hard-codes. Categories absent from
// `SwatchCategory` ('plain', 'mapq', 'tag', 'modFwd'/'modRev') are dynamic
// ramps/palettes with no single swatch and are keyed by `schemeLegend` instead.
//
// A `Record<SwatchCategory, …>` and not an array. `colorUtils` calls this pair
// correct BY CONSTRUCTION — "the legend can never list a color the renderer
// didn't paint (or omit one it did)" — and as an array only the first half of
// that held: `swatchPaletteKeys` is exhaustive over the categories, but leaving
// one out HERE compiled. `noStrand` was left out, and nothing said so.
//
// Nothing draws it today, which is why it went unnoticed: `strandCategory`
// emits it for strand 0, and neither feature source this pipeline serves can
// produce one — `SamRecordFeature.strand` is `flags & SAM_FLAG_REVERSE ? -1 : 1`
// and PAF parses `'-' ? -1 : 1`. So this is the latent half of the invariant,
// not a swatch users are missing; `presentCategories` filters the row out until
// something does emit the bucket. The type is the point.
const CATEGORY_LEGEND: Record<SwatchCategory, string> = {
  fwdStrand: 'Forward strand',
  revStrand: 'Reverse strand',
  noStrand: 'Unstranded',
  nonSplit: 'Unsplit read',
  pairLR: 'LR - Normal pair orientation',
  pairRL: 'RL - Mates point outward',
  pairLL: 'LL - Both mates forward strand',
  pairRR: 'RR - Both mates reverse strand',
  normalInsert: 'Normal',
  longInsert: 'Long insert',
  shortInsert: 'Short insert',
  // What was measured, not what it means. `splitJunctionKind` decides these from
  // the two segments' strands ALONE — never their order, their distance, or even
  // their refName — so a same-strand junction is equally a deletion, a tandem
  // duplication, a templated insertion or a same-strand translocation, and
  // "Split read (deletion)" named one of the four. Co-linear/inverted is the
  // whole of what the classifier knows; the interpretation belongs to the reader
  // (and to the docs), not to a swatch.
  splitInversion: 'Split read (inverted)',
  splitDeletion: 'Split read (co-linear)',
  interchrom: 'Inter-chromosomal',
  unmappedMate: 'Unmapped mate',
  supplementary: 'Supplementary/split',
  // the two leftover buckets, last: a read whose scheme resolved no value for
  // it. `noTagValue` is named per scheme below (no HP value / no mate).
  mapqUnavailable: 'MAPQ unavailable (255)',
  noTagValue: 'No value',
}

// Display order, taken off the exhaustive table above so the two can't be
// separately incomplete.
const CATEGORY_ORDER = Object.keys(CATEGORY_LEGEND) as SwatchCategory[]

// The wording for one category, for consumers outside the legend box that still
// have to name a color bucket — the arc hover tooltip is the first, so the
// tooltip and the swatch beside it cannot say different things about the same
// color. `undefined` for the categories the table deliberately omits (the
// dynamic ramps and palettes: mapq, tag, modifications), which have no single
// swatch and therefore no single name.
export function readColorCategoryLabel(
  category: ReadColorCategory,
): string | undefined {
  return CATEGORY_LEGEND[category as SwatchCategory]
}

// Under any scheme that colors ordinary reads by something OTHER than their own
// strand (normal, insert size, pair orientation, mapq, modifications, tag …), a
// fwd/rev-strand bucket can only have been produced by the split-read
// (chained-supplementary) branch of readColorCategory — the scheme's own
// classifier yields a different category (plain/mapq/insert/pair/…) for a
// non-split read. Naming these as split reads is what distinguishes the colored
// split segments from the scheme's grey/base-colored non-split reads in
// linked-reads (chain) mode, where only the splits pick up a color.
//
// "Forward"/"reverse" was the wrong axis to name: the branch frames each segment
// against its chain's PRIMARY (`strand * primaryStrand`), so red means agrees
// with the primary and blue means flipped at the junction — the read's own
// mapping strand is not what the color says. A reverse-mapped long read whose
// segments all agree is entirely red.
//
// That makes this the same measurement as `splitInversion`/`splitDeletion`
// above, run on disjoint data (that branch is unpaired-only, those are
// paired-only) and painted in a different pair of colors. Both wordings
// therefore land in one list — the pileup fills of a mixed BAM — and they are
// deliberately NOT identical: "segment" vs "read" says which one colored what,
// since here only the flipped segment turns blue while there the whole mate
// takes the junction's color.
const SPLIT_STRAND_LABELS: Partial<Record<SwatchCategory, string>> = {
  fwdStrand: 'Split segment (same strand)',
  revStrand: 'Split segment (flipped)',
  // the same argument, for the third member of the triple: under a non-strand
  // scheme an unstranded bucket can only have come from that same branch
  noStrand: 'Split segment (strand unknown)',
}

// The first-of-pair-strand scheme colors by the FRAGMENT strand inferred from
// the first mate (read2's strand is inverted), not each read's own strand — so a
// reverse-mapped read1 lands in the "forward" bucket. Spell that out rather than
// reusing the plain "Forward strand" wording of the strand scheme, which would
// read as the read's own strand.
const FIRST_OF_PAIR_LABELS: Partial<Record<SwatchCategory, string>> = {
  fwdStrand: 'Forward (first-in-pair)',
  revStrand: 'Reverse (first-in-pair)',
}

// Per-scheme relabeling of the shared fwd/rev-strand swatches. The plain
// `strand` scheme keeps CATEGORY_LEGEND's wording; every other scheme reframes
// fwd/rev as either the fragment strand or a split read (see the two maps
// above).
function strandLabelOverrides(colorType: ColorSchemeType | undefined) {
  return colorType === 'firstOfPairStrand'
    ? FIRST_OF_PAIR_LABELS
    : colorType === 'strand'
      ? undefined
      : SPLIT_STRAND_LABELS
}

// Per-scheme relabeling of the whole shared swatch table. On top of the strand
// rewording, the CPU-baked schemes name what the leftover neutral bucket means
// in their own terms — a read the tag is absent from, or a block with no mate —
// rather than the bare "No value" the table can't specialize.
function categoryLabelOverrides(
  colorBy: ColorBy | undefined,
): Partial<Record<SwatchCategory, string>> {
  return {
    ...strandLabelOverrides(colorBy?.type),
    ...(colorBy?.type === 'mateRefName' ? { noTagValue: 'No mate' } : {}),
    ...(colorBy?.type === 'tag' && colorBy.tag !== undefined
      ? { noTagValue: `No ${colorBy.tag} value` }
      : {}),
  }
}

// Per-base nucleotide swatches, colored from the live palette base colors.
const BASE_LEGEND: { key: keyof ColorPalette; label: string }[] = [
  { key: 'colorBaseA', label: 'A' },
  { key: 'colorBaseC', label: 'C' },
  { key: 'colorBaseG', label: 'G' },
  { key: 'colorBaseT', label: 'T' },
  { key: 'colorBaseN', label: 'N' },
]

// Tags that encode strand rather than a categorical value; buildReadTagColors
// paints these from the fixed strand colors (not colorTagMap), so their legend
// is the strand key, not a per-value list.
const STRAND_TAGS = new Set(['XS', 'TS', 'ts'])

// The methylation views key exactly what extractMethylation/extractBisulfite
// paint: 5mC red and 5hmC pink (the blue unmodified swatch is appended by the
// shared path below). The by-type MM palette — a magenta 5hmC — would mismatch
// the reads.
//
// `detectedModifications` is populated only from parsed MM/ML tags, so it is
// ALWAYS empty for bisulfite, which is reference-based (read C->T vs. the
// reference) and reads no tags at all. Gating bisulfite on it therefore dropped
// the red 5mC swatch on every bisulfite track. Bisulfite paints exactly one
// modified state, so key it unconditionally instead.
function methylationLegend(
  colorBy: ColorBy | undefined,
  detectedModifications: ReadonlyMap<string, string>,
): LegendItem[] {
  if (colorBy?.type === 'bisulfite') {
    return [{ color: methylated5mC, label: '5mC methylated' }]
  }
  const modifications = colorBy?.modifications
  const items: LegendItem[] = []
  if (
    detectedModifications.has('m') &&
    isModificationTypeVisible(modifications, 'm')
  ) {
    items.push({ color: methylated5mC, label: '5mC methylated' })
  }
  if (
    detectedModifications.has('h') &&
    isModificationTypeVisible(modifications, 'h')
  ) {
    items.push({ color: methylated5hmC, label: '5hmC methylated' })
  }
  return items
}

// The fixed-swatch buckets actually present in the reads, in CATEGORY_LEGEND
// order. These are cross-cutting: under most schemes they mark exceptions
// layered over the scheme's primary coloring — unmapped mate, inter-chromosomal,
// supplementary, and (in chain mode) the split-read strand framing — so every
// scheme appends them after its own key rather than any one branch owning them.
// fwd/rev are reworded per scheme (split read vs. fragment strand) — see
// strandLabelOverrides.
function bucketItems(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  overrides: Partial<Record<SwatchCategory, string>>,
  swatchOverrides: Partial<Record<SwatchCategory, string>> = {},
  gradients: Partial<Record<SwatchCategory, string[]>> = {},
): LegendItem[] {
  return CATEGORY_ORDER.filter(category => presentCategories.has(category)).map(
    category => ({
      color:
        swatchOverrides[category] ?? categorySwatchColor(category, palette),
      gradient: gradients[category],
      label: overrides[category] ?? CATEGORY_LEGEND[category],
    }),
  )
}

// Under `insertSizeGradient` the two outlier buckets are not flat colors: each
// read lerps from the neutral toward its endpoint by how far past the threshold
// it sits (gradientInsertColor / read.slang's insertSizeGradientColor), so most
// reads paint something between the two. A flat endpoint swatch keyed a color
// only the most extreme reads actually get — the one place the "legend can never
// list a color the renderer didn't paint" rule was loose. Key the ramp itself.
//
// Only the two outlier buckets ramp. `normalInsert` IS flat (it is the neutral
// the ramps start from), and every other scheme paints these two flat, so this
// is keyed off the scheme rather than off the category.
function insertGradients(
  colorBy: ColorBy | undefined,
  palette: ColorPalette,
): Partial<Record<SwatchCategory, string[]>> {
  if (colorBy?.type !== 'insertSizeGradient') {
    return {}
  }
  const neutral = rgb255(palette.colorPairLR)
  return {
    longInsert: [neutral, rgb255(palette.colorLongInsert)],
    shortInsert: [neutral, rgb255(palette.colorShortInsert)],
  }
}

// Short insert is the one bucket whose arc swatch is not the read swatch: a 1px
// arc curve in the pale pileup fill (colorShortInsert #ffc0cb) is invisible over
// the band, so the curves stroke the saturated variant (colorShortInsertArc,
// arcColorPalette index 2) instead. Read cloud paints filled endpoint squares
// from arcMarkerColorPalette, which is the pale fill again — same as the reads —
// so only the curve mode overrides. Read straight from the theme constant, as
// the arc palette does: arc colors are not part of the theme-overridable render
// palette, so resolving this through `palette` would key a color no arc draws.
function arcSwatches(
  mode: ReadConnectionsMode,
): Partial<Record<SwatchCategory, string>> {
  return mode === 'arc' ? { shortInsert: colorShortInsertArc } : {}
}

// …and the mark those colors are drawn AS, which is the other half of the same
// point. Once the overlay's colors are folded into the read key (the usual case
// — see `getAlignmentsLegendSections`), a square is the only thing left saying
// which vocabulary a row came from, and a square is wrong for both overlays:
// 'cloud' draws flat lines at Y=|tlen|, 'arc' draws curves.
function arcMark(mode: ReadConnectionsMode): LegendMark {
  return mode === 'cloud' ? 'line' : 'curve'
}

/**
 * Key for the paired-end arc / read-cloud colors when they are their own
 * vocabulary — insert size or pair orientation while the reads underneath are
 * colored by something else — so those get a legend section of their own. When
 * the overlay mirrors the read scheme the caller merges the buckets into the
 * read key instead (`arcColorsMatchReads`), since the two lists would be the
 * same swatches under two headings. No per-scheme rewording either way: an arc
 * never produces a strand bucket.
 *
 * Always the complete arc key. A partial overlap with the read key is resolved
 * in `getAlignmentsLegendSections`, by merging the two into one deduped list
 * rather than by subtracting here — a section that lists three of the seven
 * colors its own heading names is worse than the repetition it avoids.
 */
export function getArcLegendItems(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  mode: ReadConnectionsMode,
): LegendItem[] {
  const mark = arcMark(mode)
  return bucketItems(presentCategories, palette, {}, arcSwatches(mode)).map(
    item => ({ ...item, mark }),
  )
}

// The modification family's own key: the methylation views (fill-unmarked and
// bisulfite) key the 5mC/5hmC states, not the per-type MM palette; every other
// modification view keys each detected type in the color the reads use. Both
// append the blue "not modified" swatch whenever the mode paints that state, so
// two-color over a non-cytosine mod (blue low-probability 6mA calls) is keyed
// too — it previously showed only the 6mA swatch, leaving its blue marks
// unexplained.
function modificationLegend(
  colorBy: ColorBy,
  detectedModifications: ReadonlyMap<string, string>,
): LegendItem[] {
  const isMethylation = usesMethylationLegend(colorBy)
  const items = isMethylation
    ? methylationLegend(colorBy, detectedModifications)
    : [...detectedModifications]
        .filter(([type]) =>
          isModificationTypeVisible(colorBy.modifications, type),
        )
        .map(([type, color]) => ({ color, label: getModificationName(type) }))
  return [
    ...items,
    ...(paintsUnmodifiedState(colorBy)
      ? [
          {
            color: unmethylated5mC,
            label: isMethylation ? 'Unmethylated' : 'Unmodified',
          },
        ]
      : []),
  ]
}

// One swatch per value of a CPU-baked scheme (tag values, or mate refNames under
// chromosome painting) that the rendered reads actually carry, colored exactly
// as painted — colorTagMap holds the same color buildReadTagColors bakes into
// readTagColors. Sorted by value so the legend order stays stable as reads
// stream in rather than reordering by discovery. Empty until reads carrying a
// value load.
//
// `present` is what keeps this honest. colorTagMap only ever grows — it is
// cleared when the scheme changes and never on navigation — so listing it whole
// keyed every value the track had ever seen: pan to chr1 under chromosome
// painting and the key still named chr7 and every scaffold visited on the way,
// none of them on screen. Undefined means the caller can't tell (tests, and any
// consumer without a laid-out map), in which case the unfiltered list is still
// the best available answer.
function bakedValueLegend(
  colorTagMap: Record<string, string>,
  present: ReadonlySet<string> | undefined,
): LegendItem[] {
  return Object.entries(colorTagMap)
    .filter(([value]) => present === undefined || present.has(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, color]) => ({ color, label: value }))
}

// XS/TS/ts encode strand rather than a categorical value, so they are keyed by
// the strand pair rather than by discovered values.
function isStrandTag(colorBy: ColorBy | undefined) {
  return (
    colorBy?.type === 'tag' &&
    colorBy.tag !== undefined &&
    STRAND_TAGS.has(colorBy.tag)
  )
}

// The scheme's own key, before the cross-cutting buckets are appended. Every
// branch returns just its own swatches; nothing here reads presentCategories.
function schemeLegend(
  colorBy: ColorBy | undefined,
  palette: ColorPalette,
  detectedModifications: ReadonlyMap<string, string> | undefined,
  colorTagMap: Record<string, string>,
  presentTagValues: ReadonlySet<string> | undefined,
): LegendItem[] {
  // The normal scheme paints every read one flat color ('plain' → colorPairLR),
  // which isn't a CATEGORY_LEGEND bucket, so without an explicit entry its
  // legend would be empty and "Show legend" would render nothing.
  if (colorBy === undefined || colorBy.type === 'normal') {
    return [{ color: rgb255(palette.colorPairLR), label: 'Reads' }]
  }
  const colorType = colorBy.type
  if (isStrandTag(colorBy)) {
    // Just the two strand keys; reads with no resolvable XS/TS/ts value fall
    // back to the neutral color (see buildReadTagColors), which needs no legend
    // entry of its own.
    return [
      { color: rgb255(palette.colorFwdStrand), label: 'Forward strand' },
      { color: rgb255(palette.colorRevStrand), label: 'Reverse strand' },
    ]
  }
  if (colorType === 'tag' || colorType === 'mateRefName') {
    return bakedValueLegend(colorTagMap, presentTagValues)
  }
  if (colorType === 'mappingQuality') {
    // Ramp stops, not buckets: hue IS the score in degrees (categoryColor /
    // read.slang's hueRampHalfSat), so 60 is a stop on a continuous sweep and
    // not a ceiling — a MAPQ 70 read from an aligner that emits past bwa/
    // minimap2's cap of 60 paints its own distinct hue. The old '≥60' claimed
    // otherwise. The 255 sentinel is not on this ramp at all; it classifies as
    // `mapqUnavailable` and is keyed by the cross-cutting buckets, so it appears
    // only when reads actually carry it.
    return hslRamp(50, [
      { hue: 0, label: 'MAPQ 0' },
      { hue: 30, label: 'MAPQ 30' },
      { hue: 60, label: 'MAPQ 60' },
    ])
  }
  if (colorType === 'perBaseQuality') {
    return hslRamp(55, [
      { hue: 0, label: 'BQ 0' },
      { hue: 15, label: 'BQ 10' },
      { hue: 30, label: 'BQ 20' },
      { hue: 45, label: 'BQ 30' },
      { hue: 60, label: 'BQ 40' },
    ])
  }
  if (colorType === 'perBaseLetter') {
    return BASE_LEGEND.map(({ key, label }) => ({
      color: rgb255(palette[key]),
      label,
    }))
  }
  if (isModificationScheme(colorType) && detectedModifications) {
    return modificationLegend(colorBy, detectedModifications)
  }
  // The strand / insert-size / orientation schemes are described entirely by
  // which fixed-swatch buckets occurred.
  return []
}

/**
 * Legend items for the alignments display: the active scheme's own key followed
 * by the cross-cutting buckets (unmapped mate, inter-chromosomal, supplementary,
 * split reads in chain mode) that actually occurred. `presentCategories` is the
 * set of read buckets seen in the rendered reads (from readColorCategory), so
 * only relevant swatches are listed, and `palette` is the live render palette so
 * swatch colors match the painted reads exactly. Modification swatches come from
 * `detectedModifications` (type code -> painted color); tag / chromosome-painting
 * swatches from `colorTagMap` (value -> painted color), narrowed to
 * `presentTagValues` the way the fixed swatches are narrowed by
 * `presentCategories`; mapping/per-base quality are fixed hue ramps.
 */
export function getReadDisplayLegendItems({
  colorBy,
  presentCategories,
  palette,
  detectedModifications,
  colorTagMap = {},
  presentTagValues,
}: {
  colorBy: ColorBy | undefined
  presentCategories: ReadonlySet<ReadColorCategory>
  palette: ColorPalette
  detectedModifications?: ReadonlyMap<string, string>
  colorTagMap?: Record<string, string>
  // Values the rendered reads carry, for the CPU-baked schemes. Undefined means
  // "not known here" and leaves colorTagMap unfiltered; the empty set means the
  // scheme has values and none are on screen.
  presentTagValues?: ReadonlySet<string>
}): LegendItem[] {
  // A strand tag keys fwd/rev itself, in those exact colors, so drop them from
  // the cross-cutting tail rather than listing the same two swatches again
  // under split-read wording.
  const categories = isStrandTag(colorBy)
    ? new Set(
        [...presentCategories].filter(
          c => c !== 'fwdStrand' && c !== 'revStrand',
        ),
      )
    : presentCategories
  return [
    ...schemeLegend(
      colorBy,
      palette,
      detectedModifications,
      colorTagMap,
      presentTagValues,
    ),
    ...bucketItems(
      categories,
      palette,
      categoryLabelOverrides(colorBy),
      {},
      insertGradients(colorBy, palette),
    ),
  ]
}
