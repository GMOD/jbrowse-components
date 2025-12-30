import { fillColor } from './color'

import type { ColorBy, ModificationTypeWithColor } from './types'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

// Re-export from linear-genome-view for convenience
export { calculateSvgLegendWidth } from '@jbrowse/plugin-linear-genome-view'
export type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

const supplementaryItem: LegendItem = {
  color: fillColor.color_supplementary,
  label: 'Supplementary/split',
}

const orientationItems: LegendItem[] = [
  { color: fillColor.color_pair_lr, label: 'Normal pair orientation' },
  { color: fillColor.color_pair_rr, label: 'Both mates reverse strand' },
  { color: fillColor.color_pair_rl, label: 'Both mates point outward' },
  { color: fillColor.color_pair_ll, label: 'Both mates forward strand' },
]

/**
 * Get legend items for pileup display based on colorBy setting
 */
export function getPileupLegendItems(
  colorBy: ColorBy | undefined,
  theme: Theme,
): LegendItem[] {
  const colorType = colorBy?.type

  if (colorType === 'strand') {
    return [
      { color: fillColor.color_fwd_strand, label: 'Forward strand' },
      { color: fillColor.color_rev_strand, label: 'Reverse strand' },
      supplementaryItem,
    ]
  } else if (colorType === 'stranded') {
    return [
      { color: fillColor.color_fwd_strand, label: 'First-of-pair forward' },
      { color: fillColor.color_rev_strand, label: 'First-of-pair reverse' },
      supplementaryItem,
    ]
  } else if (colorType === 'insertSize') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
      { color: fillColor.color_unmapped_mate, label: 'Unmapped mate' },
      supplementaryItem,
    ]
  } else if (colorType === 'pairOrientation') {
    return [
      ...orientationItems,
      { color: fillColor.color_unmapped_mate, label: 'Unmapped mate' },
      supplementaryItem,
    ]
  } else if (colorType === 'insertSizeAndPairOrientation') {
    return [
      ...orientationItems,
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
      { color: fillColor.color_unmapped_mate, label: 'Unmapped mate' },
      supplementaryItem,
    ]
  } else {
    // Default: show ACGT, insertion, deletion, hardclip, softclip
    const bases = theme.palette.bases
    const insertion = theme.palette.insertion
    const deletion = theme.palette.deletion
    const hardclip = theme.palette.hardclip
    const softclip = theme.palette.softclip
    return [
      { color: bases.A.main, label: 'A' },
      { color: bases.C.main, label: 'C' },
      { color: bases.G.main, label: 'G' },
      { color: bases.T.main, label: 'T' },
      { color: insertion, label: 'Insertion' },
      { color: deletion, label: 'Deletion' },
      { color: hardclip, label: 'Hard clip' },
      { color: softclip, label: 'Soft clip' },
    ]
  }
}

/**
 * Get legend items for SNP coverage display based on colorBy setting
 */
export function getSNPCoverageLegendItems(
  colorBy: ColorBy | undefined,
  visibleModifications: Map<string, ModificationTypeWithColor>,
  theme: Theme,
): LegendItem[] {
  if (colorBy?.type === 'methylation') {
    return [
      { color: 'red', label: 'CpG methylated' },
      { color: 'blue', label: 'CpG unmethylated' },
    ]
  } else if (colorBy?.type === 'modifications') {
    const items: LegendItem[] = []
    for (const [type, mod] of visibleModifications.entries()) {
      items.push({
        color: mod.color,
        label: type,
      })
    }
    return items
  } else {
    const bases = theme.palette.bases
    const insertion = theme.palette.insertion
    const deletion = theme.palette.deletion
    const hardclip = theme.palette.hardclip
    const softclip = theme.palette.softclip

    return [
      { color: bases.A.main, label: 'A' },
      { color: bases.C.main, label: 'C' },
      { color: bases.G.main, label: 'G' },
      { color: bases.T.main, label: 'T' },
      { color: insertion, label: 'Insertion' },
      { color: deletion, label: 'Deletion' },
      { color: hardclip, label: 'Hard clip' },
      { color: softclip, label: 'Soft clip' },
    ]
  }
}

/**
 * Get legend items for read cloud/arcs display based on colorBy setting.
 * Used by both LinearReadCloudDisplay and LinearReadArcsDisplay.
 */
export function getReadDisplayLegendItems(
  colorBy: ColorBy | undefined,
  visibleModifications?: Map<string, ModificationTypeWithColor>,
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
    return [
      ...orientationItems,
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
      supplementaryItem,
    ]
  }
  if (colorType === 'insertSize') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
      supplementaryItem,
    ]
  }
  if (colorType === 'orientation') {
    return [...orientationItems, supplementaryItem]
  }

  return [supplementaryItem]
}
