import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        ldLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config PlinkLDAdapter
 * #trackType LDTrack
 * #fileFormat gwas | PLINK LD (plain .ld) | PLINK LD table; for regional analyses
 *
 * Adapter for reading pre-computed LD data from a PLINK LD table, either PLINK
 * 2.0's .vcor or PLINK 1.9's .ld.
 * Loads the entire file into memory - suitable for small to medium files.
 *
 * For large files, use PlinkLDTabixAdapter with tabix indexing.
 *
 * Expected columns, either spelling: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2, or
 * plink2's CHROM_A POS_A ID_A CHROM_B POS_B ID_B PHASED_R2 (UNPHASED_R2 for the
 * other statistic).
 * Optional columns: DP / ABS_DPRIME / DPRIME (D'), MAF_A MAF_B /
 * NONMAJ_FREQ_A NONMAJ_FREQ_B. A signed DPRIME is read as its magnitude, which
 * is all a pre-computed cell can be drawn as.
 *
 * Used by the
 * [variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
 * (triangular r² heatmap) and by
 * [GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
 * (LocusZoom-style r² to an index SNP). See either guide for generating the
 * table. `--r2-phased` is the statistic the LD display computes from genotypes,
 * so it is the one whose cells compare with a live triangle.
 *
 * ```bash
 * plink2 --bfile study --r2-unphased --out study
 * ```
 *
 * Writes `study.vcor`, tab-delimited with a commented header:
 *
 * ```
 * #CHROM_A	POS_A	ID_A	CHROM_B	POS_B	ID_B	UNPHASED_R2
 * 1	729679	rs4970383	1	752566	rs3131972	0.0925926
 * 1	729679	rs4970383	1	754182	rs3131969	0.157316
 * ```
 *
 * PLINK 1.9's `plink --bfile study --r2 --out study` writes the same table as
 * `study.ld`, space-padded with a bare header, and loads too.
 *
 * #example
 * ```js
 * {
 *   type: 'PlinkLDAdapter',
 *   uri: 'https://example.com/study.ld',
 * }
 * ```
 */
const PlinkLDAdapter = ConfigurationSchema(
  'PlinkLDAdapter',
  {
    /**
     * #slot
     * Location of the PLINK LD table (.ld, .ld.gz or .vcor)
     */
    ldLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/plink.ld',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * Preprocessor to allow minimal config:
     *
     * ```json
     * {
     *   "type": "PlinkLDAdapter",
     *   "uri": "plink.ld"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default PlinkLDAdapter
