// Single source of truth for the geneGlyphMode display setting.
//
// 'auto' switches based on zoom, 'all' shows every transcript, 'longestCoding'
// shows only the longest coding transcript.
export const GENE_GLYPH_MODES = ['auto', 'all', 'longestCoding'] as const

export type GeneGlyphMode = (typeof GENE_GLYPH_MODES)[number]

// The old CanvasFeatureRenderer had a 'longest' value (longest transcript,
// coding or not) that was dropped. Map it to 'longestCoding', the closest
// surviving single-transcript mode, so old configs don't fail enum validation.
export function legacyGeneGlyphMode(value: unknown): unknown {
  return value === 'longest' ? 'longestCoding' : value
}
