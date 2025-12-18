import { fillColor } from './color'

import type { ColorBy, ModificationTypeWithColor } from './types'
import type { Theme } from '@mui/material'

export interface LegendItem {
  color?: string
  label: string
}

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
    ]
  }
  if (colorType === 'stranded') {
    return [
      { color: fillColor.color_fwd_strand, label: 'First-of-pair forward' },
      { color: fillColor.color_rev_strand, label: 'First-of-pair reverse' },
    ]
  }
  if (colorType === 'insertSize') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
      { color: fillColor.color_unmapped_mate, label: 'Unmapped mate' },
    ]
  }
  if (colorType === 'pairOrientation') {
    return [
      { color: fillColor.color_pair_lr, label: 'LR (proper)' },
      { color: fillColor.color_pair_rr, label: 'RR' },
      { color: fillColor.color_pair_rl, label: 'RL' },
      { color: fillColor.color_pair_ll, label: 'LL' },
      { color: fillColor.color_unmapped_mate, label: 'Unmapped mate' },
    ]
  }
  if (colorType === 'insertSizeAndPairOrientation') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal (LR)' },
      { color: fillColor.color_pair_rr, label: 'RR orientation' },
      { color: fillColor.color_pair_rl, label: 'RL orientation' },
      { color: fillColor.color_pair_ll, label: 'LL orientation' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
      { color: fillColor.color_unmapped_mate, label: 'Unmapped mate' },
    ]
  }

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
  }
  if (colorBy?.type === 'modifications') {
    const items: LegendItem[] = []
    for (const [type, mod] of visibleModifications.entries()) {
      items.push({
        color: mod.color,
        label: type,
      })
    }
    return items
  }

  const bases = theme.palette.bases
  const insertion = theme.palette.insertion
  const deletion = theme.palette.deletion
  return [
    { color: bases.A.main, label: 'A' },
    { color: bases.C.main, label: 'C' },
    { color: bases.G.main, label: 'G' },
    { color: bases.T.main, label: 'T' },
    { color: insertion, label: 'Insertion' },
    { color: deletion, label: 'Deletion' },
  ]
}

/**
 * Get legend items for read cloud/arcs display based on colorBy setting
 */
export function getReadCloudLegendItems(
  colorBy: ColorBy | undefined,
  visibleModifications?: Map<string, ModificationTypeWithColor>,
): LegendItem[] {
  const colorType = colorBy?.type

  if (colorType === 'modifications' && visibleModifications) {
    const items: LegendItem[] = []
    for (const [type, mod] of visibleModifications.entries()) {
      items.push({ color: mod.color, label: type })
    }
    return items
  }
  if (colorType === 'insertSizeAndOrientation') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal (LR)' },
      { color: fillColor.color_pair_rr, label: 'RR orientation' },
      { color: fillColor.color_pair_rl, label: 'RL orientation' },
      { color: fillColor.color_pair_ll, label: 'LL orientation' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
    ]
  }
  if (colorType === 'insertSize') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
    ]
  }
  if (colorType === 'orientation') {
    return [
      { color: fillColor.color_pair_lr, label: 'LR (proper)' },
      { color: fillColor.color_pair_rr, label: 'RR' },
      { color: fillColor.color_pair_rl, label: 'RL' },
      { color: fillColor.color_pair_ll, label: 'LL' },
    ]
  }

  return []
}

/**
 * Get legend items for read arcs display based on colorBy setting
 */
export function getReadArcsLegendItems(
  colorBy: ColorBy | undefined,
): LegendItem[] {
  const colorType = colorBy?.type

  if (colorType === 'insertSizeAndOrientation') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal (LR)' },
      { color: fillColor.color_pair_rr, label: 'RR orientation' },
      { color: fillColor.color_pair_rl, label: 'RL orientation' },
      { color: fillColor.color_pair_ll, label: 'LL orientation' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
    ]
  }
  if (colorType === 'insertSize') {
    return [
      { color: fillColor.color_pair_lr, label: 'Normal' },
      { color: fillColor.color_longinsert, label: 'Long insert' },
      { color: fillColor.color_shortinsert, label: 'Short insert' },
      { color: fillColor.color_interchrom, label: 'Inter-chromosomal' },
    ]
  }
  if (colorType === 'orientation') {
    return [
      { color: fillColor.color_pair_lr, label: 'LR (proper)' },
      { color: fillColor.color_pair_rr, label: 'RR' },
      { color: fillColor.color_pair_rl, label: 'RL' },
      { color: fillColor.color_pair_ll, label: 'LL' },
    ]
  }

  return []
}
