import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { GENE_GLYPH_DEFAULTS } from '../RenderFeatureDataRPC/renderConfig.ts'

/**
 * #config FeatureTranscripts
 * #category display
 * The feature display's `transcripts`: which children read as a gene's
 * isoforms, and the order they rank in. `field` names the attribute holding
 * a curated tag and `sort` the tag values that rank first, in order, as a
 * `facet` sorts; the isoforms past the list follow by coding length. The
 * first-ranked is the one transcript `geneGlyphMode: 'longestCoding'` draws,
 * and the first kept when `auto` caps a gene at the rows the track has.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   transcripts: { field: 'tag', sort: ['MANE Select', 'Ensembl_canonical'] },
 * }
 * ```
 */
export const featureTranscriptsConfigSchema = ConfigurationSchema(
  'FeatureTranscripts',
  {
    /**
     * #slot
     * Types the `geneLike` filter field counts beside every gene,
     * transcript and RNA type, and the fallback for recognizing a childless
     * transcript as one of a gene's isoforms. Not the isoform test: keying
     * that off this list dropped every `lnc_RNA` and `misc_RNA` isoform NCBI
     * hangs off a gene.
     */
    types: {
      type: 'stringArray',
      defaultValue: GENE_GLYPH_DEFAULTS.transcriptTypes,
    },
    /**
     * #slot
     * The attribute holding an isoform's curated "this one represents the
     * gene" tag.
     */
    field: {
      type: 'string',
      defaultValue: GENE_GLYPH_DEFAULTS.canonicalTranscriptField,
    },
    /**
     * #slot
     * The values of `field` that rank an isoform first, in order.
     */
    sort: {
      type: 'stringArray',
      defaultValue: GENE_GLYPH_DEFAULTS.canonicalTranscriptTags,
    },
  },
  { closed: true },
)
