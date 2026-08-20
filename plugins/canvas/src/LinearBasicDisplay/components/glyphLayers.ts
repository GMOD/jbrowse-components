// One LGV feature-glyph draw layer.
export type GlyphLayerId = 'line' | 'rect' | 'arrow' | 'continuation'

/**
 * This display's glyph set and its paint order, back to front. Both backends
 * iterate this list and map each id through an exhaustive
 * `Record<GlyphLayerId, …>` — the GPU renderer to its `drawPass` calls, Canvas2D
 * (and so the SVG export, which shares `drawFeatureBlocks`) to its painter — so
 * a glyph added here is a compile error in either backend until it is wired.
 * Stated once, because a glyph added to the GPU renderer alone compiles,
 * registers, draws, and is missing from every exported SVG.
 *
 * **No `enabled` column, unlike `PILEUP_LAYERS`.** These glyphs answer to a
 * feature's shape rather than to a setting, and both backends skip an empty
 * layer for free. A gate column would be four `() => true`s. Add one with the
 * first glyph a menu can switch off, and give it a hit-test story at the same
 * time (`HIT_GATES`).
 *
 * Shorter than the pass list on purpose: `chevron` and `continuation` are
 * separate GPU passes only because each draws from a lender's vertex buffer,
 * which is a buffer-sharing artifact rather than a layer — Canvas2D paints
 * chevrons inside `drawLines`. So `line` is one slot covering both marks.
 * `continuation` earns its own because it paints last, over the glyphs it
 * annotates, in both backends.
 */
export const GLYPH_LAYERS: GlyphLayerId[] = [
  'line',
  'rect',
  'arrow',
  'continuation',
]
