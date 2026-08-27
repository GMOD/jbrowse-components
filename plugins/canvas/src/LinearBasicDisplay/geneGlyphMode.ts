// Single source of truth for the geneGlyphMode display setting.
//
// 'auto' switches on zoom and trims what the track height cannot hold, 'all'
// shows every transcript and is exempt from that trim (`showsEveryIsoform`
// withholds the fit ladder's isoform rung, so the surplus scrolls),
// 'longestCoding' shows one transcript per gene.
//
// The 'longestCoding' value name is historical and stays for config
// compatibility: since the isoform ranking learned to read RefSeq Select / MANE
// Select, coding length is what it falls back to rather than what it does, so
// the label says "representative".
export const GENE_GLYPH_MODES = ['auto', 'all', 'longestCoding'] as const

export type GeneGlyphMode = (typeof GENE_GLYPH_MODES)[number]

// Shared value/label list so the track menu and the on-canvas isoform-collapse
// dropdown offer identical, single-sourced options.
export const GENE_GLYPH_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'all', label: 'All transcripts' },
  { value: 'longestCoding', label: 'Representative transcript' },
] as const satisfies readonly { value: GeneGlyphMode; label: string }[]

// The old CanvasFeatureRenderer had a 'longest' value (longest transcript,
// coding or not) that was dropped. Map it to 'longestCoding', the closest
// surviving single-transcript mode, so old configs don't fail enum validation.
export function legacyGeneGlyphMode(value: unknown): unknown {
  return value === 'longest' ? 'longestCoding' : value
}
