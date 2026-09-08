/**
 * Classification of a feature from its `type` string alone, for the plugins
 * that decide something about a feature they did not parse. A type is the only
 * thing a display, a menu or a widget can ask about a feature without knowing
 * which adapter produced it, so these live in core rather than beside any one
 * of their callers.
 */

// Anchored at the end for gene and RNA so 'intergenic_region' is not a gene and
// 'rnapol_binding_site' is not an RNA. Unanchored for transcript, which SO
// spells both ways ('transcript', 'pseudogenic_transcript', 'transcript_region').
const GENE_LIKE_TYPE = /gene(_segment)?$|rna$|transcript/

/**
 * Whether the type names a unit of transcription — a gene, a transcript, or an
 * RNA, including the pseudogene and V(D)J segment spellings. This is the
 * question "does this feature have exons", not "can this feature be spliced":
 * an alignment splices too and is deliberately not gene-like, because a caller
 * that means to launch a protein view or read a CDS would be wrong about it.
 */
export function isGeneLikeType(type: string | undefined) {
  return type !== undefined && GENE_LIKE_TYPE.test(type.toLowerCase())
}

// SO `match` and every subtype of it is spelled `<something>_match`, so the
// suffix is the family. `match_part`, the child, is excluded by the anchor.
const SEQUENCE_MATCH_TYPE = /(^|_)match$/

/**
 * Whether the type names a sequence alignment — SO `match` and its subtypes
 * (`cDNA_match`, `EST_match`, `nucleotide_match`, `protein_match`,
 * `translated_nucleotide_match`), whose `match_part` children are the aligned
 * blocks and whose gaps between them are introns when the aligned sequence was
 * a transcript. Separate from `isGeneLikeType` on purpose: an EST alignment is
 * evidence for a gene, not one.
 */
export function isSequenceMatchType(type: string | undefined) {
  return type !== undefined && SEQUENCE_MATCH_TYPE.test(type.toLowerCase())
}
