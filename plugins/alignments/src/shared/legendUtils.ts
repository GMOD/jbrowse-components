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
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

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
// `strand` scheme (and undefined = no relabel here) keeps CATEGORY_LEGEND's
// wording; every other scheme reframes fwd/rev as either the fragment strand or
// a split read (see the two maps above).
function strandLabelOverrides(colorType: ColorSchemeType | undefined) {
  return colorType === 'firstOfPairStrand' || colorType === 'stranded'
    ? FIRST_OF_PAIR_LABELS
    : colorType === 'strand'
      ? undefined
      : SPLIT_STRAND_LABELS
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
function crossCuttingBuckets(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  colorType: ColorSchemeType | undefined,
): LegendItem[] {
  const overrides = strandLabelOverrides(colorType)
  return CATEGORY_LEGEND.filter(({ category }) =>
    presentCategories.has(category),
  ).map(({ category, label }) => ({
    color: categorySwatchColor(category, palette),
    label: overrides?.[category] ?? label,
  }))
}

/**
 * Legend items for the alignments display. `presentCategories` is the set of
 * read buckets actually seen in the rendered reads (from readColorCategory), so
 * only relevant swatches are listed, and `palette` is the live render palette so
 * swatch colors match the painted reads exactly. Modification swatches come from
 * `detectedModifications` (type code -> painted color); mapping/per-base quality
 * are fixed hue ramps.
 */
export function getReadDisplayLegendItems(
  colorBy: ColorBy | undefined,
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  detectedModifications?: ReadonlyMap<string, string>,
  colorTagMap?: Record<string, string>,
): LegendItem[] {
  const colorType = colorBy?.type
  const buckets = crossCuttingBuckets(presentCategories, palette, colorType)

  if (colorType === 'tag') {
    const tag = colorBy?.tag
    if (tag && STRAND_TAGS.has(tag)) {
      // Just the two strand keys; reads with no resolvable XS/TS/ts value fall
      // back to the neutral color (see buildReadTagColors), which needs no
      // legend entry of its own.
      return [
        { color: rgb255(palette.colorFwdStrand), label: 'Forward strand' },
        { color: rgb255(palette.colorRevStrand), label: 'Reverse strand' },
      ]
    }
    // One swatch per discovered tag value, colored exactly as painted
    // (colorTagMap holds the palette color baked into readTagColors). Sorted by
    // value so the legend order stays stable as reads stream in rather than
    // reordering by discovery. Empty until reads with the tag load.
    const values = Object.entries(colorTagMap ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, color]) => ({ color, label: value }))
    return [...values, ...buckets]
  }

  if (colorType === 'mappingQuality') {
    return [
      ...hslRamp(50, [
        { hue: 0, label: 'MAPQ 0' },
        { hue: 30, label: 'MAPQ 30' },
        { hue: 60, label: 'MAPQ ≥60' },
      ]),
      ...buckets,
    ]
  }
  if (colorType === 'perBaseQuality') {
    return [
      ...hslRamp(55, [
        { hue: 0, label: 'BQ 0' },
        { hue: 15, label: 'BQ 10' },
        { hue: 30, label: 'BQ 20' },
        { hue: 45, label: 'BQ 30' },
        { hue: 60, label: 'BQ 40' },
      ]),
      ...buckets,
    ]
  }
  if (colorType === 'perBaseLetter') {
    return [
      ...BASE_LEGEND.map(({ key, label }) => ({
        color: rgb255(palette[key]),
        label,
      })),
      ...buckets,
    ]
  }
  if (colorType && isModificationScheme(colorType) && detectedModifications) {
    // The methylation views (fill-unmarked and bisulfite) key the 5mC/5hmC
    // states, not the per-type MM palette; every other modification view keys
    // each detected type in the color the reads use.
    const isMethylation = usesMethylationLegend(colorBy)
    const items = isMethylation
      ? methylationLegend(colorBy, detectedModifications)
      : [...detectedModifications]
          .filter(([type]) =>
            isModificationTypeVisible(colorBy.modifications, type),
          )
          .map(([type, color]) => ({ color, label: getModificationName(type) }))
    // Both keys append the blue "not modified" swatch whenever the mode paints
    // that state, so two-color over a non-cytosine mod (blue low-probability 6mA
    // calls) is keyed too — it previously showed only the 6mA swatch, leaving
    // its blue marks unexplained. Split reads (chain mode) and supplementary /
    // unmapped-mate exceptions carry their own fixed swatches, last.
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
      ...buckets,
    ]
  }

  // The normal scheme paints every read one flat color ('plain' → colorPairLR),
  // which isn't a CATEGORY_LEGEND bucket, so without an explicit entry its
  // legend would be empty and "Show legend" would render nothing. Prepend a
  // base-reads swatch so the toggle always shows something, keeping any
  // cross-cutting buckets (unmapped mate, split reads in chain mode) after it.
  if (colorType === undefined || colorType === 'normal') {
    return [{ color: rgb255(palette.colorPairLR), label: 'Reads' }, ...buckets]
  }
  // The strand / insert-size / orientation schemes are described entirely by
  // which fixed-swatch buckets occurred.
  return buckets
}
