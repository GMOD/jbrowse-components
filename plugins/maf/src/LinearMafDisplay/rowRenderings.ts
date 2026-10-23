/**
 * What colors an aligned cell: its base where it differs from the
 * reference, every base, the mean identity to the reference, the rank of its
 * block's source chromosome within the row, or its codon's amino-acid change.
 */
export const MAF_COLOR_FIELDS = [
  'mismatch',
  'base',
  'identity',
  'chromosome',
  'codon',
] as const

export type MafColorField = (typeof MAF_COLOR_FIELDS)[number]

/** What a row's bar height carries, where the row is a bar chart. */
export const MAF_Y_FIELDS = ['identity'] as const

export type MafYField = (typeof MAF_Y_FIELDS)[number]

/**
 * What the rows paint: a color field's cells, or the X-Y plot, whose bars
 * carry identity on their height.
 */
export type RowRendering = MafColorField | 'xyplot'

/** The Color by menu's rows, in menu order; codon only with reading frames. */
export const MAF_COLOR_FIELD_LABELS = {
  mismatch: 'Mismatches (SNPs vs reference)',
  base: 'Every base',
  identity: 'Identity to reference',
  chromosome: 'Source chromosome',
  codon: 'Codon changes (amino acids)',
} as const satisfies Record<MafColorField, string>

/** Whether a rendering paints the cells base by base. */
export function paintsBases(rendering: RowRendering) {
  return rendering === 'mismatch' || rendering === 'base'
}

/** How identity draws: heatmap cells, or X-Y bars in one color or the ramp's. */
export type IdentityEncoding = 'heatmap' | 'bars' | 'rampBars'

export interface RowPlan {
  /** what colors the cells now */
  color: MafColorField
  /** what the bars' height carries now, undefined where rows are cells */
  y: MafYField | undefined
  rendering: RowRendering
  /** the cells are drawn base by base, so letters and indels draw over them */
  bases: boolean
  identity: IdentityEncoding | undefined
}

/**
 * What the rows draw from the written `encoding.color` and `encoding.y` and the view's
 * state. The summary tier draws its own bars, so the cells fall back to the
 * mismatches there. At base level a one-base identity is a match call the
 * bases draw with more to say, so identity in either plot yields to them, and
 * the codon view needs base level and a frames adapter to define codons.
 */
export function resolveRowPlan({
  field,
  y,
  summaryTier,
  baseLevel,
  hasFrames,
}: {
  field: MafColorField
  y: MafYField | undefined
  summaryTier: boolean
  baseLevel: boolean
  hasFrames: boolean
}): RowPlan {
  const color: MafColorField =
    summaryTier ||
    (field === 'codon' && !(hasFrames && baseLevel)) ||
    (field === 'identity' && baseLevel)
      ? 'mismatch'
      : field
  const rowsY = summaryTier || baseLevel ? undefined : y
  return {
    color,
    y: rowsY,
    rendering: rowsY ? 'xyplot' : color,
    bases: !summaryTier && !rowsY && paintsBases(color),
    identity:
      rowsY === 'identity'
        ? color === 'identity'
          ? 'rampBars'
          : 'bars'
        : color === 'identity'
          ? 'heatmap'
          : undefined,
  }
}
