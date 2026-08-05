import type { RowIdentityMode } from './rowIdentityModes.ts'

/**
 * What the per-sample rows can be colored by. These are alternatives, not
 * independent overlays — `activeRowRendering` picks exactly one — so they are
 * presented as one radio group, the same shape wiggle's "Plot type" uses for
 * its mutually-exclusive renderings.
 *
 * They are stored across three config slots (`showTranslation`,
 * `colorByChromosome`, `rowIdentityMode`) rather than one, because each
 * predates the others and a saved session names them individually. The menu
 * writes the combination and `selectedRowRendering` reads it back; the slots
 * stay the persisted form.
 */
export type RowRendering = 'bases' | 'codon' | 'sourceChrom' | RowIdentityMode

/** `[value, menu label]`, the `makeRadioSubMenu` shape. */
export const ROW_RENDERINGS = [
  ['bases', 'Bases (SNPs vs reference)'],
  ['heatmap', 'Identity heatmap'],
  ['xyplot', 'Identity X-Y plot'],
  ['sourceChrom', 'Source chromosome'],
] as const satisfies readonly (readonly [RowRendering, string])[]

/**
 * The codon option, listed only where a `mafFrames` adapter can define the
 * reading frame — the same condition the CDS-frame rows in the Show submenu
 * appear under. Separate from `ROW_RENDERINGS` rather than filtered out of it
 * so the gate is stated once, where the reason lives.
 */
export const CODON_ROW_RENDERING = [
  'codon',
  'Codon changes (amino acids)',
] as const satisfies readonly [RowRendering, string]
