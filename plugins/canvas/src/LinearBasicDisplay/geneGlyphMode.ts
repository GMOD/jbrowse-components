// Every mode here draws transcripts the file names. A fourth that drew the
// UNION of them — one row per gene holding every isoform's exons, what UCSC
// calls dense and Ensembl collapsed — was built and declined: the row reads as
// a gene model while corresponding to no molecule, since each of its
// boundaries can come from a different isoform. A mode that reduces a gene
// picks one of its transcripts; it does not synthesize one.
//
// 'representative' draws the first isoform by `transcripts.sort` (MANE or
// RefSeq Select), else the longest coding.
export const GENE_GLYPH_MODES = ['auto', 'all', 'representative'] as const

export type GeneGlyphMode = (typeof GENE_GLYPH_MODES)[number]

export const GENE_GLYPH_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'all', label: 'All transcripts' },
  { value: 'representative', label: 'Representative transcript' },
] as const satisfies readonly { value: GeneGlyphMode; label: string }[]

/** `auto` draws every transcript up to 100 bp/px and one per gene past it. */
export function resolvedGeneGlyphMode(mode: GeneGlyphMode, bpPerPx: number) {
  return mode === 'auto' ? (bpPerPx > 100 ? 'representative' : 'all') : mode
}

// v4.3.0's 'longestCoding' and the old renderer's 'longest' both drew one
// transcript per gene.
export function legacyGeneGlyphMode(value: unknown): unknown {
  return value === 'longest' || value === 'longestCoding'
    ? 'representative'
    : value
}
