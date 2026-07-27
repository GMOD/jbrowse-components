import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'

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
import type { ColorPalette } from '../LinearAlignmentsDisplay/shaders/colors.ts'
import type { ColorBy, ColorSchemeType } from './types.ts'
import type { LegendItem, LegendSection } from '@jbrowse/core/ui'

export type { LegendItem } from '@jbrowse/core/ui'

// One row per color. A swatch means one thing in a legend box, so a color that
// two vocabularies both produce is keyed once, under the first label it got —
// the arcs' neutral slot and the reads' LR slot are both `colorPairLR`, and
// "Normal" listed under "LR - Normal pair orientation" is the same grey twice.
// Color-less rows (headings, notes) are never merged.
function oneRowPerColor(items: LegendItem[]): LegendItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const dup = item.color !== undefined && seen.has(item.color)
    if (item.color !== undefined) {
      seen.add(item.color)
    }
    return !dup
  })
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
  const readColors = new Set(reads.map(i => i.color))
  const merge = arcs.some(a => readColors.has(a.color))
  return [
    merge
      ? {
          id: 'reads',
          title: mergedTitle(model.arcLegendTitle),
          items: oneRowPerColor([...reads, ...arcs]),
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

// Each fixed-swatch category with its label, in display order. The swatch color
// is resolved from the live palette (categorySwatchColor), so the only thing
// the legend hard-codes is the wording. Categories not listed here ('plain',
// 'mapq', 'tag', 'modFwd'/'modRev') are dynamic ramps/palettes with no single
// swatch. Driving the legend off this table means it lists exactly the buckets
// the renderer produced (readColorCategory) — no per-scheme item arrays.
const CATEGORY_LEGEND: { category: SwatchCategory; label: string }[] = [
  { category: 'fwdStrand', label: 'Forward strand' },
  { category: 'revStrand', label: 'Reverse strand' },
  { category: 'nonSplit', label: 'Unsplit read' },
  { category: 'pairLR', label: 'LR - Normal pair orientation' },
  { category: 'pairRL', label: 'RL - Mates point outward' },
  { category: 'pairLL', label: 'LL - Both mates forward strand' },
  { category: 'pairRR', label: 'RR - Both mates reverse strand' },
  { category: 'normalInsert', label: 'Normal' },
  { category: 'longInsert', label: 'Long insert' },
  { category: 'shortInsert', label: 'Short insert' },
  { category: 'splitInversion', label: 'Split-read inversion' },
  { category: 'splitDeletion', label: 'Split read (deletion)' },
  { category: 'interchrom', label: 'Inter-chromosomal' },
  { category: 'unmappedMate', label: 'Unmapped mate' },
  { category: 'supplementary', label: 'Supplementary/split' },
  // last: the leftover bucket of the CPU-baked schemes, named per scheme below
  { category: 'noTagValue', label: 'No value' },
]

// Under any scheme that colors ordinary reads by something OTHER than their own
// strand (normal, insert size, pair orientation, mapq, modifications, tag …), a
// fwd/rev-strand bucket can only have been produced by the split-read
// (chained-supplementary) branch of readColorCategory — the scheme's own
// classifier yields a different category (plain/mapq/insert/pair/…) for a
// non-split read. Naming these as split reads is what distinguishes the colored
// split segments from the scheme's grey/base-colored non-split reads in
// linked-reads (chain) mode, where only the splits pick up a color.
const SPLIT_STRAND_LABELS: Partial<Record<SwatchCategory, string>> = {
  fwdStrand: 'Split read (forward)',
  revStrand: 'Split read (reverse)',
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
): LegendItem[] {
  return CATEGORY_LEGEND.filter(({ category }) =>
    presentCategories.has(category),
  ).map(({ category, label }) => ({
    color: categorySwatchColor(category, palette),
    label: overrides[category] ?? label,
  }))
}

function crossCuttingBuckets(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  colorBy: ColorBy | undefined,
): LegendItem[] {
  return bucketItems(
    presentCategories,
    palette,
    categoryLabelOverrides(colorBy),
  )
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
): LegendItem[] {
  return bucketItems(presentCategories, palette, {})
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

// One swatch per discovered value of a CPU-baked scheme (tag values, or mate
// refNames under chromosome painting), colored exactly as painted — colorTagMap
// holds the same color buildReadTagColors bakes into readTagColors. Sorted by
// value so the legend order stays stable as reads stream in rather than
// reordering by discovery. Empty until reads carrying a value load.
function bakedValueLegend(colorTagMap: Record<string, string>): LegendItem[] {
  return Object.entries(colorTagMap)
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
    return bakedValueLegend(colorTagMap)
  }
  if (colorType === 'mappingQuality') {
    return hslRamp(50, [
      { hue: 0, label: 'MAPQ 0' },
      { hue: 30, label: 'MAPQ 30' },
      { hue: 60, label: 'MAPQ ≥60' },
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
 * swatches from `colorTagMap` (value -> painted color); mapping/per-base quality
 * are fixed hue ramps.
 */
export function getReadDisplayLegendItems({
  colorBy,
  presentCategories,
  palette,
  detectedModifications,
  colorTagMap = {},
}: {
  colorBy: ColorBy | undefined
  presentCategories: ReadonlySet<ReadColorCategory>
  palette: ColorPalette
  detectedModifications?: ReadonlyMap<string, string>
  colorTagMap?: Record<string, string>
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
    ...schemeLegend(colorBy, palette, detectedModifications, colorTagMap),
    ...crossCuttingBuckets(categories, palette, colorBy),
  ]
}
