import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config AllVsAllPAFAdapter
 * #trackType SyntenyTrack
 * Loads a single "all-vs-all" PAF (e.g. `minimap2 all.fa all.fa`, or the PGGB
 * mapping step) where every sequence name is PanSN-prefixed with its assembly
 * (`sample#haplotype#contig`). Because such a file contains every pairwise
 * alignment, one file (and one track) backs every synteny band of a multi-way
 * view: list all the assemblies in `assemblyNames` and the same track can be
 * reused for each adjacent pair. The synteny view tells the adapter which pair a
 * given band draws, and the adapter keeps only those records, stripping the
 * PanSN prefix to recover each assembly's own refName. Listing just two
 * assemblies keeps the track pinned to that single pair.
 *
 * #example
 * ```js
 * {
 *   type: 'AllVsAllPAFAdapter',
 *   uri: 'all_vs_all.paf.gz',
 *   assemblyNames: ['grape', 'peach', 'cacao'],
 * }
 * ```
 */
const AllVsAllPAFAdapter = ConfigurationSchema(
  'AllVsAllPAFAdapter',
  {
    /**
     * #slot
     * The assemblies this track can draw. List every assembly in the file to let
     * one track back all bands of a multi-way view (the view picks each band's
     * pair), or just two to pin the track to a single pair. Every entry must
     * resolve to a PanSN sample prefix present in the file.
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    /**
     * #slot
     * can be optionally gzipped
     */
    pafLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.paf',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for
     * when they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1`
     * would need `{ grape: 'Vitis_vinifera' }`). Defaults to identity: the
     * assembly name is assumed to be the PanSN sample name.
     */
    assemblyNameToPanSN: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "AllVsAllPAFAdapter",
     *   "uri": "file.paf.gz",
     *   "assemblyNames": ["grape", "peach"]
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            pafLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export type AllVsAllPAFAdapterConfig = Instance<typeof AllVsAllPAFAdapter>

export default AllVsAllPAFAdapter
