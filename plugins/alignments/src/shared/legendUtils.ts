import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'

import { isModificationScheme } from './colorSchemes.ts'
import { getModificationName } from './modificationData.ts'
import { isModificationTypeVisible, paintsUnmethylatedState } from './types.ts'
import {
  categorySwatchColor,
  rgb255,
} from '../LinearAlignmentsDisplay/colorUtils.ts'

import type {
  ColorBy,
  ColorSchemeType,
  ModificationColorBy,
  ModificationTypeWithColor,
} from './types.ts'
import type {
  ReadColorCategory,
  SwatchCategory,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ColorPalette } from '../LinearAlignmentsDisplay/shaders/colors.ts'
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
  { category: 'noStrand', label: 'No strand' },
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
// linked-reads (chain) mode, where only the splits pick up a color. Strand
// schemes color every read by its own strand, so they keep the plain wording
// (see STRAND_PRIMARY_SCHEMES).
const SPLIT_STRAND_LABELS: Partial<Record<SwatchCategory, string>> = {
  fwdStrand: 'Split read (forward)',
  revStrand: 'Split read (reverse)',
}

// Schemes whose primary coloring IS the read's own strand, so a fwd/rev bucket
// is the key itself rather than a split-read exception to relabel.
const STRAND_PRIMARY_SCHEMES = new Set<ColorSchemeType>([
  'strand',
  'firstOfPairStrand',
  'stranded',
])

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

// The methylation (fill-unmarked) view keys exactly what extractMethylation
// paints: 5mC red, 5hmC pink, and every implicitly-unmodified cytosine — the
// color that floods a hypomethylated region — blue. The by-type MM palette (a
// magenta 5hmC, no "unmethylated" swatch at all) would mismatch the reads.
function fillUnmarkedLegend(
  modifications: ModificationColorBy | undefined,
  visibleModifications: ReadonlyMap<string, ModificationTypeWithColor>,
): LegendItem[] {
  const items: LegendItem[] = []
  if (
    visibleModifications.has('m') &&
    isModificationTypeVisible(modifications, 'm')
  ) {
    items.push({ color: methylated5mC, label: '5mC methylated' })
  }
  if (
    visibleModifications.has('h') &&
    isModificationTypeVisible(modifications, 'h')
  ) {
    items.push({ color: methylated5hmC, label: '5hmC methylated' })
  }
  items.push({ color: unmethylated5mC, label: 'Unmethylated' })
  return items
}

// The fixed-swatch buckets actually present in the reads, in CATEGORY_LEGEND
// order. These are cross-cutting: under most schemes they mark exceptions
// layered over the scheme's primary coloring — unmapped mate, inter-chromosomal,
// supplementary, and (in chain mode) the split-read strand framing — so every
// scheme appends them after its own key rather than any one branch owning them.
// fwd/rev get the split-read wording unless the active scheme is itself
// strand-based (see SPLIT_STRAND_LABELS / STRAND_PRIMARY_SCHEMES).
function crossCuttingBuckets(
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  colorType: ColorSchemeType | undefined,
): LegendItem[] {
  const splitFraming =
    colorType === undefined || !STRAND_PRIMARY_SCHEMES.has(colorType)
  return CATEGORY_LEGEND.filter(({ category }) =>
    presentCategories.has(category),
  ).map(({ category, label }) => ({
    color: categorySwatchColor(category, palette),
    label: splitFraming ? (SPLIT_STRAND_LABELS[category] ?? label) : label,
  }))
}

/**
 * Legend items for the alignments display. `presentCategories` is the set of
 * read buckets actually seen in the rendered reads (from readColorCategory), so
 * only relevant swatches are listed, and `palette` is the live render palette so
 * swatch colors match the painted reads exactly. Modification swatches come from
 * `visibleModifications`; mapping/per-base quality are fixed hue ramps.
 */
export function getReadDisplayLegendItems(
  colorBy: ColorBy | undefined,
  presentCategories: ReadonlySet<ReadColorCategory>,
  palette: ColorPalette,
  visibleModifications?: ReadonlyMap<string, ModificationTypeWithColor>,
  colorTagMap?: Record<string, string>,
): LegendItem[] {
  const colorType = colorBy?.type
  const buckets = crossCuttingBuckets(presentCategories, palette, colorType)

  if (colorType === 'tag') {
    const tag = colorBy?.tag
    if (tag && STRAND_TAGS.has(tag)) {
      return [
        { color: rgb255(palette.colorFwdStrand), label: 'Forward strand' },
        { color: rgb255(palette.colorRevStrand), label: 'Reverse strand' },
        { color: rgb255(palette.colorNostrand), label: 'No strand' },
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
  if (colorType && isModificationScheme(colorType) && visibleModifications) {
    // The methylation views that paint an explicit unmethylated state
    // (fill-unmarked and bisulfite) key those states, not the per-type MM
    // palette; every other modification view keys each detected type in the
    // color the reads use.
    const items = paintsUnmethylatedState(colorBy)
      ? fillUnmarkedLegend(colorBy.modifications, visibleModifications)
      : [...visibleModifications]
          .filter(([type]) =>
            isModificationTypeVisible(colorBy.modifications, type),
          )
          .map(([type, mod]) => ({
            color: mod.color,
            label: getModificationName(type),
          }))
    // Split reads (chain mode) and supplementary/unmapped-mate exceptions carry
    // their own fixed swatches, appended after the modification-type key.
    return [...items, ...buckets]
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
