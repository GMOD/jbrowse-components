import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'ldLocation')
}

/**
 * #config PlinkLDTabixAdapter
 * #trackType LDTrack
 * #fileFormat gwas | PLINK LD (tabix-indexed .ld.gz) | For chromosome-scale or genome-wide LD
 *
 * Adapter for reading pre-computed LD data from PLINK --r2 output (tabix-indexed).
 *
 * The input file should be bgzipped and tabix-indexed:
 *
 * ```bash
 * plink --bfile study --r2 --out study
 * # plink pads its columns with spaces and tabix indexes on tabs, so retab as
 * # well as commenting the header; sort-bed is `sort -k1,1 -k2,2n` under
 * # LC_ALL=C with the `#` line kept on top
 * awk 'NR == 1 {$1 = "#"$1} {$1 = $1}1' OFS='\t' study.ld |
 *   jbrowse sort-bed | bgzip > study.sorted.ld.gz
 * tabix -s 1 -b 2 -e 2 study.sorted.ld.gz
 * ```
 *
 * Comment the header with `#` rather than counting it with `tabix -S 1`. Both
 * keep it out of the data, but only the commented form is what `tabix -H`
 * prints and what readers ask for first, so a `-S 1` header is easy to miss —
 * and missing it means missing the `DP` column, which is what makes D'
 * available instead of only r². (Not `-c C`: that makes `C` the meta character,
 * so every `chr1`-style data row would read as a comment.) A file already
 * indexed with `-S 1` still loads.
 *
 * Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2
 * Optional columns: DP (D'), MAF_A, MAF_B
 *
 * `study.ld` before bgzipping, whitespace-delimited:
 *
 * ```
 * CHR_A  BP_A     SNP_A       CHR_B  BP_B     SNP_B       R2
 * 1      729679   rs4970383   1      752566   rs3131972   0.0925926
 * 1      729679   rs4970383   1      754182   rs3131969   0.157316
 * ```
 *
 * Used by the
 * [variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
 * (triangular r² heatmap) and by
 * [GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
 * (LocusZoom-style r² to an index SNP). See either guide for generating the .ld
 * file with `plink --r2`.
 *
 * #example
 * ```js
 * {
 *   type: 'PlinkLDTabixAdapter',
 *   uri: 'https://example.com/study.sorted.ld.gz',
 * }
 * ```
 */

const PlinkLDTabixAdapter = ConfigurationSchema(
  'PlinkLDTabixAdapter',
  {
    /**
     * #slot
     * Location of the bgzipped PLINK LD file (.ld.gz)
     */
    ldLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/plink.ld.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
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
     *   "type": "PlinkLDTabixAdapter",
     *   "uri": "plink.ld.gz"
     * }
     * ```
     *
     * Add `"csi": true` for a `.csi` index, as on every other tabix adapter.
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default PlinkLDTabixAdapter
