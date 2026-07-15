import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config AllVsAllIndexedPAFAdapter
 * #trackType SyntenyTrack
 * The tabix-indexed (PIF) form of the `AllVsAllPAFAdapter`. Run
 * `jbrowse make-pif all_vs_all.paf` on an all-vs-all PAF whose sequence names
 * are PanSN-prefixed (`sample#haplotype#contig`) and point this adapter at the
 * resulting `.pif.gz`. Because PIF double-emits each record keyed on both of its
 * PanSN sequence names, a region query resolves to a tabix range lookup on the
 * anchor's PanSN seqid(s) instead of scanning the whole file — so it scales to
 * whole-genome pangenome alignments that do not fit in memory. Semantics match
 * `AllVsAllPAFAdapter`: one-vs-all in a plain LGV, single-pair when the synteny
 * view supplies a `targetAssemblyName`.
 *
 * #example
 * ```js
 * {
 *   type: 'AllVsAllIndexedPAFAdapter',
 *   uri: 'all_vs_all.pif.gz',
 *   assemblyNames: ['grape', 'peach', 'cacao'],
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        pifGzLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        index: {
          indexType: snap.csi ? 'CSI' : 'TBI',
          location: {
            uri: `${snap.uri}.${snap.csi ? 'csi' : 'tbi'}`,
            baseUri: snap.baseUri,
          },
        },
      }
    : snap
}

const AllVsAllIndexedPAFAdapter = ConfigurationSchema(
  'AllVsAllIndexedPAFAdapter',
  {
    /**
     * #slot
     * The assemblies this track appears on and can back synteny bands for — list
     * the assemblies you load into JBrowse. Each entry must resolve to a PanSN
     * sample prefix present in the file. In a plain LGV the track still draws its
     * assembly against every other sample in the file, so mates need not be
     * listed here (unlisted mates are labelled by their PanSN prefix).
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    /**
     * #slot
     */
    pifGzLocation: {
      type: 'fileLocation',
      description: 'location of the all-vs-all tabix indexed PAF (pif)',
      defaultValue: {
        uri: '/path/to/all_vs_all.pif.gz',
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
    /**
     * #slot
     * bpPerPx threshold at which the reader switches from the per-row CIGAR tier
     * (lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix),
     * when make-pif was run with a coarse tier. No coarse tier present in the
     * file = always uses fine tier.
     */
    coarseBpPerPxThreshold: {
      type: 'number',
      defaultValue: 10000,
      advanced: true,
    },
    /**
     * #slot
     */
    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/all_vs_all.pif.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes all_vs_all.pif.gz.tbi:
     * ```json
     * {
     *   "type": "AllVsAllIndexedPAFAdapter",
     *   "uri": "all_vs_all.pif.gz",
     *   "assemblyNames": ["grape", "peach", "cacao"]
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type AllVsAllIndexedPAFAdapterConfig = Instance<
  typeof AllVsAllIndexedPAFAdapter
>

export default AllVsAllIndexedPAFAdapter
