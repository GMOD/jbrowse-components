// Every mode here draws transcripts the file names. A fourth that drew the
// UNION of them — one row per gene holding every isoform's exons, what UCSC
// calls dense and Ensembl collapsed — was built and declined: the row reads as
// a gene model while corresponding to no molecule, since each of its
// boundaries can come from a different isoform. A mode that reduces a gene
// picks one of its transcripts; it does not synthesize one.
//
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
