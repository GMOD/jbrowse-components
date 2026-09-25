/**
 * What colours an aligned cell: its base where it differs from the
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
 * The Row coloring radio's options: a colour field each, and the X-Y plot,
 * which is identity on the bar height.
 */
export type RowRendering = MafColorField | 'xyplot'

/** `[value, menu label]`, the `makeRadioSubMenu` shape. */
export const ROW_RENDERINGS = [
  ['mismatch', 'Bases (SNPs vs reference)'],
  ['base', 'Bases (every base colored)'],
  ['identity', 'Identity heatmap'],
  ['xyplot', 'Identity X-Y plot'],
  ['chromosome', 'Source chromosome'],
] as const satisfies readonly (readonly [RowRendering, string])[]

/** Listed only where a `mafFrames` adapter defines the reading frame. */
export const CODON_ROW_RENDERING = [
  'codon',
  'Codon changes (amino acids)',
] as const satisfies readonly [RowRendering, string]

/** The settings a Row coloring pick writes. */
export function rowRenderingSettings(rendering: RowRendering): {
  color: MafColorField
  y: MafYField | undefined
} {
  return rendering === 'xyplot'
    ? { color: 'mismatch', y: 'identity' }
    : { color: rendering, y: undefined }
}

/** Whether a rendering paints the cells base by base. */
export function paintsBases(rendering: RowRendering) {
  return rendering === 'mismatch' || rendering === 'base'
}
