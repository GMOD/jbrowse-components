import {
  ConfigurationSchema,
  tabixIndexFields,
} from '@jbrowse/core/configuration'

import { expandMafShorthand, tabixIndexSlot } from '../util/mafShorthand.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MafTabixAdapter
 * #trackType MafTrack
 * #fileFormat maf | MAF (tabix)
 * Multiple alignment format converted to a bgzipped, tabix-indexed BED. The
 * `nhLocation` newick tree orders and labels the species rows; `refAssemblyName`
 * names the MAF's reference species when it differs from the assembly name.
 *
 * #example
 * ```js
 * {
 *   type: 'MafTabixAdapter',
 *   bedGzLocation: { uri: 'https://example.com/multiz.bed.gz' },
 *   index: { location: { uri: 'https://example.com/multiz.bed.gz.tbi' } },
 *   nhLocation: { uri: 'https://example.com/multiz.nh' },
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'MafTabixAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description:
        'string[] or {id:string,label:string,color?:string,assemblyName?:string,assemblyConfigLocation?:UriLocation}[]; assemblyName makes rows for that sample navigable to its own genome, and assemblyConfigLocation says where to load that assembly from when the session lacks it',
      defaultValue: [],
    },
    /**
     * #slot
     * location of the bgzip-compressed BED that `maf2bed` writes from a MAF:
     * one line per alignment block, with every species' aligned bases packed
     * into the last column.
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * name of the MAF's reference species, spelled as it appears in the file's
     * `s` lines (the `hg38` of `hg38.chr1`). Set it when that differs from the
     * JBrowse assembly name; left empty, the reference row is looked up by the
     * queried assembly's name and falls back to the block's first species.
     */
    refAssemblyName: {
      type: 'string',
      defaultValue: '',
    },
    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * The zoom-out tier. A tabix MAF carries every species' bases on one line,
     * so a wide read downloads the whole alignment and the byte gate blocks it;
     * without this slot the track simply has no zoom-out path. Point it at a
     * `BedTabixAdapter` over the summary BED `maf2bed --summary` writes (one
     * merged run per species, no sequence), or at a `BigBedAdapter` over a UCSC
     * `bigMafSummary.bb` covering the same alignment.
     */
    summaryAdapter: {
      type: 'frozen',
      description:
        'optional swappable sub-adapter (a BedTabixAdapter over a maf2bed --summary BED, or a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it',
      defaultValue: null,
    },
    /**
     * #slot
     */
    annotationAdapter: {
      type: 'frozen',
      description:
        'optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it',
      defaultValue: null,
    },
  },
  {
    explicitlyTyped: true,
    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.bed.gz.tbi:
     *
     * ```json
     * {
     *   "type": "MafTabixAdapter",
     *   "uri": "yourfile.bed.gz",
     *   "samples": ["sample1", "sample2"]
     * }
     * ```
     */
    preProcessSnapshot: snap =>
      expandMafShorthand(snap, 'bedGzLocation', tabixIndexSlot),
  },
)

export type MafTabixAdapterConfig = Instance<typeof configSchema>

export default configSchema
