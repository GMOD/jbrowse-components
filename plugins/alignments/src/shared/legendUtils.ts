import {
  categorySwatchColor,
  rgb255,
} from '../LinearAlignmentsDisplay/colorUtils.ts'

import type { ColorBy, ModificationTypeWithColor } from './types.ts'
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
  { category: 'pairLR', label: 'LR - Normal pair orientation' },
  { category: 'pairRL', label: 'RL - Mates point outward' },
  { category: 'pairLL', label: 'LL - Both mates forward strand' },
  { category: 'pairRR', label: 'RR - Both mates reverse strand' },
  { category: 'normalInsert', label: 'Normal' },
  { category: 'longInsert', label: 'Long insert' },
  { category: 'shortInsert', label: 'Short insert' },
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
): LegendItem[] {
  const colorType = colorBy?.type

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
  if (
    (colorType === 'modifications' ||
      colorType === 'methylation' ||
      colorType === 'bisulfite') &&
    visibleModifications
  ) {
    const items: LegendItem[] = []
    for (const [type, mod] of visibleModifications.entries()) {
      items.push({ color: mod.color, label: type })
    }
    if (presentCategories.has('supplementary')) {
      items.push({
        color: categorySwatchColor('supplementary', palette),
        label: 'Supplementary/split',
      })
    }
    return items
  }

  // Every remaining scheme (normal, strand, insert size, orientation, tag, …)
  // is described entirely by which fixed-swatch buckets occurred.
  return CATEGORY_LEGEND.filter(({ category }) =>
    presentCategories.has(category),
  ).map(({ category, label }) => ({
    color: categorySwatchColor(category, palette),
    label,
  }))
}
