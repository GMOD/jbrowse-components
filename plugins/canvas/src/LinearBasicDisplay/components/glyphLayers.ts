export type GlyphLayerId = 'line' | 'rect' | 'arrow' | 'continuation'

/**
 * Paint order, back to front. Both backends map every id through an exhaustive
 * `Record<GlyphLayerId, …>`, so a glyph added here fails the build until each
 * one wires it; a glyph wired only in the GPU renderer draws on screen and is
 * missing from every exported SVG.
 */
export const GLYPH_LAYERS: GlyphLayerId[] = [
  'line',
  'rect',
  'arrow',
  'continuation',
]
