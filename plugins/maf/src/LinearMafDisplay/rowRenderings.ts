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
