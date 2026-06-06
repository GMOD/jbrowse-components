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

function hslRamp(
  saturation: number,
  steps: { hue: number; label: string }[],
): LegendItem[] {
  return steps.map(({ hue, label }) => ({
    color: `hsl(${hue}, ${saturation}%, 50%)`,
    label,
  }))
}

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

const interchromItem: LegendItem = {
  color: colorInterchrom,
  label: 'Inter-chromosomal',
}

const insertSizeItems: LegendItem[] = [
  { color: colorLongInsert, label: 'Long insert' },
  { color: colorShortInsert, label: 'Short insert' },
  interchromItem,
]

const insertSizeLegendItems: LegendItem[] = [
  { color: colorPairLR, label: 'Normal' },
  ...insertSizeItems,
  unmappedMateItem,
  supplementaryItem,
]

const insertSizeGradientLegendItems: LegendItem[] = [
  { color: colorLongInsert, label: 'Long insert' },
  { color: colorPairLR, label: 'Normal' },
  { color: colorShortInsert, label: 'Short insert' },
  interchromItem,
  unmappedMateItem,
  supplementaryItem,
]

const pairOrientationLegendItems: LegendItem[] = [
  ...orientationItems,
  interchromItem,
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
  if (colorType === 'pairOrientation') {
    return pairOrientationLegendItems
  }
  if (colorType === 'insertSize') {
    return insertSizeLegendItems
  }
  if (colorType === 'mappingQuality') {
    return hslRamp(50, [
      { hue: 0, label: 'MAPQ 0' },
      { hue: 30, label: 'MAPQ 30' },
      { hue: 60, label: 'MAPQ ≥60' },
    ])
  }
  if (colorType === 'insertSizeGradient') {
    return insertSizeGradientLegendItems
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
