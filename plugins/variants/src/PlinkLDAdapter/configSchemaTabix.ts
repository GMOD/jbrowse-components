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
 * Adapter for reading pre-computed LD data from a PLINK LD table
 * (tabix-indexed), either PLINK 2.0's .vcor or PLINK 1.9's .ld.
 *
 * The input file should be bgzipped and tabix-indexed:
 *
 * ```bash
 * plink2 --bfile study --r2-unphased --out study
 * # plink2 writes tabs and comments its own header, so sort-bed takes the table
 * # as it is; sort-bed is `sort -k1,1 -k2,2n` under LC_ALL=C with the `#` line
 * # kept on top
 * jbrowse sort-bed < study.vcor | bgzip > study.sorted.ld.gz
 * tabix -s 1 -b 2 -e 2 study.sorted.ld.gz
 * ```
 *
 * PLINK 1.9 writes the same table space-padded with a bare header, so there it
 * needs a retab first:
 *
 * ```bash
 * plink --bfile study --r2 --out study
 * awk 'NR == 1 {$1 = "#"$1} {$1 = $1}1' OFS='\t' study.ld |
 *   jbrowse sort-bed | bgzip > study.sorted.ld.gz
 * ```
 *
 * Comment the header with `#` rather than counting it with `tabix -S 1`. Both
 * keep it out of the data, but only the commented form is what `tabix -H`
 * prints and what readers ask for first, so a `-S 1` header is easy to miss —
 * and missing it means missing the D' column, which is what makes D'
 * available instead of only r². (Not `-c C`: that makes `C` the meta character,
 * so every `chr1`-style data row would read as a comment.) A file already
 * indexed with `-S 1` still loads.
 *
 * Expected columns, either spelling: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2, or
 * plink2's CHROM_A POS_A ID_A CHROM_B POS_B ID_B PHASED_R2 (UNPHASED_R2 for the
 * other statistic).
 * Optional columns: DP / ABS_DPRIME / DPRIME (D'), MAF_A MAF_B /
 * NONMAJ_FREQ_A NONMAJ_FREQ_B. A signed DPRIME is read as its magnitude, which
 * is all a pre-computed cell can be drawn as.
 *
 * `study.vcor` before bgzipping, plink2 adding `cols=` for anything past r²:
 *
 * ```
 * #CHROM_A	POS_A	ID_A	CHROM_B	POS_B	ID_B	UNPHASED_R2
 * 1	729679	rs4970383	1	752566	rs3131972	0.0925926
 * 1	729679	rs4970383	1	754182	rs3131969	0.157316
 * ```
 *
 * Used by the
 * [variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
 * (triangular r² heatmap) and by
 * [GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
 * (LocusZoom-style r² to an index SNP). See either guide for generating the
 * table. `--r2-phased` is the statistic the LD display computes from genotypes,
 * so it is the one whose cells compare with a live triangle.
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
     * Location of the bgzipped PLINK LD table (.ld.gz or .vcor.gz)
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
