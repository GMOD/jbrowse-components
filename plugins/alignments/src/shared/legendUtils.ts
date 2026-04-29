import { fillColor } from './color.ts'

import type { ColorBy, ModificationTypeWithColor } from './types.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

const supplementaryItem: LegendItem = {
  color: fillColor.color_supplementary,
  label: 'Supplementary/split',
}

const unmappedMateItem: LegendItem = {
  color: fillColor.color_unmapped_mate,
  label: 'Unmapped mate',
}

const orientationItems: LegendItem[] = [
  { color: fillColor.color_pair_lr, label: 'Normal pair orientation' },
  { color: fillColor.color_pair_rr, label: 'Both mates reverse strand' },
  { color: fillColor.color_pair_rl, label: 'Both mates point outward' },
  { color: fillColor.color_pair_ll, label: 'Both mates forward strand' },
]

const insertSizeItems: LegendItem[] = [
  { color: fillColor.color_longinsert, label: 'Long insert' },
  { color: fillColor.color_shortinsert, label: 'Short insert' },
  { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
]

const orientationLegendItems: LegendItem[] = [
  ...orientationItems,
  unmappedMateItem,
  supplementaryItem,
]

const insertSizeLegendItems: LegendItem[] = [
  { color: fillColor.color_pair_lr, label: 'Normal' },
  ...insertSizeItems,
  unmappedMateItem,
  supplementaryItem,
]

const insertSizeAndOrientationLegendItems: LegendItem[] = [
  ...orientationItems,
  ...insertSizeItems,
  unmappedMateItem,
  supplementaryItem,
]

const samplotLegendItems: LegendItem[] = [
  { color: fillColor.color_samplot_del, label: 'Deletion / normal (FR)' },
  { color: fillColor.color_samplot_dup, label: 'Duplication (RF)' },
  { color: fillColor.color_samplot_inv, label: 'Inversion (FF / RR)' },
  { color: fillColor.color_interchrom, label: 'Interchromosomal (BND)' },
]

/**
 * Get legend items for read cloud/arcs display based on colorBy setting.
 * Used by both LinearReadCloudDisplay and LinearReadArcsDisplay.
 */
export function getReadDisplayLegendItems(
  colorBy: ColorBy | undefined,
  visibleModifications?: ReadonlyMap<string, ModificationTypeWithColor>,
): LegendItem[] {
  const colorType = colorBy?.type

  if (colorType === 'modifications' && visibleModifications) {
    const items: LegendItem[] = []
    for (const [type, mod] of visibleModifications.entries()) {
      items.push({ color: mod.color, label: type })
    }
    items.push(supplementaryItem)
    return items
  }
  if (colorType === 'insertSizeAndOrientation') {
    return insertSizeAndOrientationLegendItems
  }
  if (colorType === 'insertSize') {
    return insertSizeLegendItems
  }
  if (colorType === 'orientation') {
    return orientationLegendItems
  }
  if (colorType === 'samplot') {
    return samplotLegendItems
  }
  if (colorType === 'mappingQuality') {
    return [
      { color: 'hsl(0, 50%, 50%)', label: 'MAPQ 0' },
      { color: 'hsl(30, 50%, 50%)', label: 'MAPQ 30' },
      { color: 'hsl(60, 50%, 50%)', label: 'MAPQ 60' },
    ]
  }
  if (colorType === 'baseQuality') {
    return [
      { color: 'hsl(0, 50%, 50%)', label: 'BQ 0' },
      { color: 'hsl(10, 50%, 50%)', label: 'BQ 10' },
      { color: 'hsl(20, 50%, 50%)', label: 'BQ 20' },
      { color: 'hsl(30, 50%, 50%)', label: 'BQ 30' },
    ]
  }
  if (colorType === 'strand') {
    return [
      { color: fillColor.color_fwd_strand, label: 'Forward strand' },
      { color: fillColor.color_rev_strand, label: 'Reverse strand' },
      supplementaryItem,
    ]
  }

  return [supplementaryItem]
}
