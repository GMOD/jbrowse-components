import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'

import { isModificationScheme } from './colorSchemes.ts'
import { getModificationName } from './modificationData.ts'
import { isFillUnmarkedMode, isModificationTypeVisible } from './types.ts'
import {
  categorySwatchColor,
  rgb255,
} from '../LinearAlignmentsDisplay/colorUtils.ts'

import type {
  ColorBy,
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
    return Object.entries(colorTagMap ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, color]) => ({ color, label: value }))
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
  if (colorType && isModificationScheme(colorType) && visibleModifications) {
    // The methylation (fill-unmarked) view paints the three states
    // extractMethylation produces, not the per-type MM palette; every other
    // modification view keys each detected type in the color the reads use.
    const items = isFillUnmarkedMode(colorBy)
      ? fillUnmarkedLegend(colorBy.modifications, visibleModifications)
      : [...visibleModifications]
          .filter(([type]) =>
            isModificationTypeVisible(colorBy.modifications, type),
          )
          .map(([type, mod]) => ({
            color: mod.color,
            label: getModificationName(type),
          }))
    if (presentCategories.has('supplementary')) {
      items.push({
        color: categorySwatchColor('supplementary', palette),
        label: 'Supplementary/split',
      })
    }
    return items
  }

  // Every remaining scheme (strand, insert size, orientation, tag, …) is
  // described entirely by which fixed-swatch buckets occurred.
  const buckets = CATEGORY_LEGEND.filter(({ category }) =>
    presentCategories.has(category),
  ).map(({ category, label }) => ({
    color: categorySwatchColor(category, palette),
    label,
  }))

  // The normal scheme paints every read one flat color ('plain' → colorPairLR),
  // which isn't a CATEGORY_LEGEND bucket, so without an explicit entry its
  // legend would be empty and "Show legend" would render nothing. Prepend a
  // base-reads swatch so the toggle always shows something, keeping any
  // cross-cutting buckets (unmapped mate, supplementary in chain mode) after it.
  if (colorType === undefined || colorType === 'normal') {
    return [{ color: rgb255(palette.colorPairLR), label: 'Reads' }, ...buckets]
  }
  return buckets
}
