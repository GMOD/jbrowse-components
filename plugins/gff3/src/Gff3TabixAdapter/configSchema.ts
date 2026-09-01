import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'
import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'gffGzLocation')
}

/**
 * #config Gff3TabixAdapter
 * #category adapter
 * #trackType FeatureTrack
 * #fileFormat feature | GFF3 (tabix)
 * used to load bgzip-compressed, tabix-indexed GFF3 files
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a
 * `.csi` index instead:
 * ```js
 * {
 *   type: 'Gff3TabixAdapter',
 *   uri: 'https://example.com/genes.gff3.gz',
 * }
 * ```
 */
const Gff3TabixAdapter = ConfigurationSchema(
  'Gff3TabixAdapter',
  {
    /**
     * #slot
     * location of the bgzip-compressed GFF3, sorted by position. Must be bgzip
     * rather than plain gzip, which tabix cannot index.
     */
    gffGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gff.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
    /**
     * #slot
     * the Gff3TabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we requested.
     * you can disable this for certain feature types to avoid fetching e.g. the
     * entire chromosome
     *
     * the defaults are the whole-sequence records the common GFF3 sources emit:
     * `region` (NCBI), `supercontig`/`scaffold` (Ensembl, for non-chromosomal
     * sequences), plus `chromosome` and `contig`. They span an entire reference
     * and have no children, so letting one expand the fetch would pull a whole
     * chromosome to gain nothing
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: [
        'chromosome',
        'region',
        'contig',
        'supercontig',
        'scaffold',
      ],
    },
    ...densityAdapterConfigSchemaFields,
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.gff3.gz.tbi (or .csi if csi:true):
     *
     * ```json
     * {
     *   "type": "Gff3TabixAdapter",
     *   "uri": "yourfile.gff3.gz",
     *   "csi": true
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type Gff3TabixAdapterConfig = Instance<typeof Gff3TabixAdapter>

export default Gff3TabixAdapter
