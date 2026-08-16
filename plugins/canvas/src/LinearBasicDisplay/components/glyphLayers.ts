// One LGV feature-glyph draw layer.
export type GlyphLayerId = 'line' | 'rect' | 'arrow' | 'continuation'

/**
 * Single source of truth for this display's glyph set and its paint order, back
 * to front. Both backends iterate this list and map each id through an
 * exhaustive `Record<GlyphLayerId, …>` — the GPU renderer to its `drawPass`
 * calls, the Canvas2D renderer (and so the SVG export, which shares
 * `drawFeatureBlocks`) to its painter — so adding a glyph here is a compile
 * error in either backend until it is wired.
 *
 * The order was stated twice before, once per backend, with nothing connecting
 * them. They agreed; what they lacked was a reason to keep agreeing. A glyph
 * added to the GPU renderer alone compiles, registers and draws, and is missing
 * from Canvas2D and from every exported SVG — the same silent half-add that
 * stood in the alignments coverage band for two months
 * (`agent-docs/reference/REJECTED_IDEAS.md`, "Unified GPU/Canvas2D layer
 * manifest").
 *
 * **No `enabled` column, unlike `PILEUP_LAYERS`.** These glyphs answer to a
 * feature's shape rather than to a setting: a display draws lines where its
 * features have subfeatures and arrows where they have strand, and both
 * backends already skip an empty layer for free — the GPU because `drawPass`
 * short-circuits a region with no buffer, Canvas2D because the painter's loop
 * has nothing to iterate. A gate column here would be four `() => true`s, which
 * states a policy nobody has. Add one with the first glyph a menu can switch
 * off, and give it a hit-test story at the same time (`HIT_GATES`).
 *
 * The list is shorter than the pass list on purpose. `chevron` and
 * `continuation` are separate GPU passes because each draws from a *lender's*
 * vertex buffer (line's and rect's respectively, via `drawPass`'s
 * `bufferPassId`), which is a GPU buffer-sharing artifact rather than a layer:
 * Canvas2D paints chevrons inside `drawLines`, per line. So `line` is one slot
 * covering both marks, the way alignments' `clip` is one slot covering soft and
 * hard clips. `continuation` earns a slot of its own because it paints last, on
 * top of the glyphs it annotates, in both backends.
 */
export const GLYPH_LAYERS: GlyphLayerId[] = [
  'line',
  'rect',
  'arrow',
  'continuation',
]
