import {
  colorFwdStrand,
  colorInterchrom,
  colorLongInsert,
  colorPairLL,
  colorPairLR,
  colorPairRL,
  colorPairRR,
  colorRevStrand,
  colorShortInsert,
  colorSupplementary,
  colorUnmappedMate,
} from '@jbrowse/core/ui/theme'
import { blue, brown, green, orange, red } from '@mui/material/colors'

import type { ColorBy, ModificationTypeWithColor } from './types.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

const supplementaryItem: LegendItem = {
  color: colorSupplementary,
  label: 'Supplementary/split',
}

const unmappedMateItem: LegendItem = {
  color: colorUnmappedMate,
  label: 'Unmapped mate',
}

const orientationItems: LegendItem[] = [
  { color: colorPairLR, label: 'LR - Normal pair orientation' },
  { color: colorPairRL, label: 'RL - Mates point outward' },
  { color: colorPairLL, label: 'LL - Both mates forward strand' },
  { color: colorPairRR, label: 'RR - Both mates reverse strand' },
]

const insertSizeItems: LegendItem[] = [
  { color: colorLongInsert, label: 'Long insert' },
  { color: colorShortInsert, label: 'Short insert' },
  { color: colorInterchrom, label: 'Inter-chromosomal' },
]

const insertSizeLegendItems: LegendItem[] = [
  { color: colorPairLR, label: 'Normal' },
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

/**
 * Get legend items for read cloud/arcs display based on colorBy setting.
 * Used by both LinearReadCloudDisplay and LinearReadArcsDisplay. Read cloud
 * (samplot) and arcs share this legend since both color by the same scheme.
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
  if (colorType === 'perBaseQuality') {
    return [
      { color: 'hsl(0, 55%, 50%)', label: 'BQ 0' },
      { color: 'hsl(15, 55%, 50%)', label: 'BQ 10' },
      { color: 'hsl(30, 55%, 50%)', label: 'BQ 20' },
      { color: 'hsl(45, 55%, 50%)', label: 'BQ 30' },
      { color: 'hsl(60, 55%, 50%)', label: 'BQ 40' },
    ]
  }
  if (colorType === 'perBaseLetter') {
    // Mirrors theme.palette.bases (augment(green/blue/orange/red/brown)); the
    // actual rects use the live theme palette, these swatches the defaults.
    return [
      { color: green[500], label: 'A' },
      { color: blue[500], label: 'C' },
      { color: orange[500], label: 'G' },
      { color: red[500], label: 'T' },
      { color: brown[500], label: 'N' },
    ]
  }
  if (colorType === 'strand') {
    return [
      { color: colorFwdStrand, label: 'Forward strand' },
      { color: colorRevStrand, label: 'Reverse strand' },
      supplementaryItem,
    ]
  }

  return [supplementaryItem]
}
