// 'longestCoding' stays for config compatibility: the isoform ranking reads
// RefSeq Select / MANE Select first and falls back to coding length, so the
// label says representative.
export const GENE_GLYPH_MODES = ['auto', 'all', 'longestCoding'] as const

export type GeneGlyphMode = (typeof GENE_GLYPH_MODES)[number]

export const GENE_GLYPH_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'all', label: 'All transcripts' },
  { value: 'longestCoding', label: 'Representative transcript' },
] as const satisfies readonly { value: GeneGlyphMode; label: string }[]

// The old renderer's 'longest' maps to the closest surviving
// single-transcript mode, so old configs pass enum validation.
export function legacyGeneGlyphMode(value: unknown): unknown {
  return value === 'longest' ? 'longestCoding' : value
}
