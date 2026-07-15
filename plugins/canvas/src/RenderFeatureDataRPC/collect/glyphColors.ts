import { cssColorToABGR as colorToUint32 } from '@jbrowse/core/util/colorBits'
import { colord } from '@jbrowse/core/util/colord'

import { getFeatureName } from '../labelUtils.ts'
import { readConfigValueSafe, resolveThemeColor } from '../renderConfig.ts'
import { getBoxColor, getStrokeColor } from '../util.ts'

import type { RenderContext } from './renderContext.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

// transl_except residues (selenocysteine, pyrrolysine, polyA-completed stops)
// get a distinct background so the readthrough stands out from the alternating
// codon shading — matches the orange `translExceptColor` swatch the
// feature-detail protein view uses.
export const TRANSL_EXCEPT_HIGHLIGHT = colorToUint32('#ffc850')

// Each mature-protein region gets a distinct fill from this palette (by row
// order) so adjacent cleavage products are visually separable; matches the
// legacy CanvasFeatureRenderer.
export const MATURE_PROTEIN_COLOR_HEX = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
  '#aec7e8', // light blue
  '#ffbb78', // light orange
]
export const MATURE_PROTEIN_COLORS = MATURE_PROTEIN_COLOR_HEX.map(c =>
  colorToUint32(c),
)

// CRISPR guide glyph: the PAM is overpainted red and the predicted cut site is
// a dark tick, both drawn over the (config-colored) protospacer box, so they
// read regardless of page theme since the box itself is their background.
export const CRISPR_PAM_COLOR = colorToUint32('#d32f2f')
export const CRISPR_CUT_COLOR = colorToUint32('#111111')

// Per-subpart fills for intact transposons, keyed by SO type, ported verbatim
// from the legacy CanvasFeatureRenderer repeatRegion glyph. Stable colors (not
// a by-row palette) so the two LTRs share a color and the TSDs share another.
export const REPEAT_COLOR_MAP: Record<string, string> = {
  CACTA_TIR_transposon: '#e6194b',
  centromeric_repeat: '#3cb44b',
  Copia_LTR_retrotransposon: '#118119',
  Gypsy_LTR_retrotransposon: '#4363d8',
  hAT_TIR_transposon: '#f58231',
  helitron: '#911eb4',
  knob: '#46f0f0',
  L1_LINE_retrotransposon: '#f032e6',
  LINE_element: '#bcf60c',
  long_terminal_repeat: '#fb0',
  low_complexity: '#008080',
  LTR_retrotransposon: '#e6beff',
  Mutator_TIR_transposon: '#9a6324',
  PIF_Harbinger_TIR_transposon: '#fffac8',
  rDNA_intergenic_spacer_element: '#800000',
  repeat_region: '#aaffc3',
  RTE_LINE_retrotransposon: '#808000',
  subtelomere: '#ffd8b1',
  target_site_duplication: '#000075',
  Tc1_Mariner_TIR_transposon: '#808080',
}

// Fraction of full height for the internal retrotransposon body so the
// full-height LTRs/TSDs drawn on top of it remain visible as flanking caps.
export const REPEAT_BODY_HEIGHT_FRACTION = 0.65

export function boxColor(feature: Feature, ctx: RenderContext) {
  return getBoxColor({
    feature,
    config: ctx.config,
    colorByCDS: ctx.colorByCDS,
    theme: ctx.theme,
    jexl: ctx.jexl,
  })
}

export function strokeColor(feature: Feature, ctx: RenderContext) {
  return getStrokeColor({
    feature,
    config: ctx.config,
    theme: ctx.theme,
    jexl: ctx.jexl,
  })
}

// Hover tooltip = the display's `mouseover` config slot evaluated against the
// full feature (the same slot the old SVG renderer used on the main thread), so
// a custom override — including one calling a plugin-registered jexl function —
// drives the text. Done worker-side because the full feature is already here;
// shipping a large feature back just to format a string would be wasteful. A
// throwing override degrades to the feature name rather than failing the render.
export function featureTooltip(feature: Feature, ctx: RenderContext) {
  return String(
    readConfigValueSafe<unknown>(
      ctx.config,
      'mouseover',
      feature,
      ctx.jexl,
      getFeatureName(feature) ?? '',
    ),
  )
}

// Feature-box outline. Empty means no outline (packed as 0). The menu toggle
// stores THEME_DERIVED_COLOR, resolved to text.primary at low alpha so the
// outline stays visible on both light and dark tracks (a fixed black outline
// vanishes on a dark background); in light mode this matches the old black-0.3.
export function resolveOutlineColor(outlineColor: string, theme: Theme) {
  const faint = colord(theme.palette.text.primary).alpha(0.3).toRgbString()
  const c = resolveThemeColor(outlineColor, faint)
  return c ? colorToUint32(c) : 0
}
