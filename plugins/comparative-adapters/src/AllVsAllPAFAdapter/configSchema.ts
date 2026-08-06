import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config AllVsAllPAFAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | All-vs-all PAF | PanSN-prefixed; one file backs every pair in a multi-way view
 * Loads a single "all-vs-all" PAF (e.g. `minimap2 all.fa all.fa`, or the PGGB
 * mapping step) where every sequence name is PanSN-prefixed with its assembly
 * (`sample#haplotype#contig`). Because such a file contains every pairwise
 * alignment, one file (and one track) backs every synteny band of a multi-way
 * view: the synteny view tells the adapter which pair a given band draws, and
 * the adapter keeps only those records, stripping the PanSN prefix to recover
 * each assembly's own refName. In a plain LGV (LGVSyntenyDisplay) there is no
 * band to isolate, so the track draws its assembly against every OTHER sample
 * in the file — "one vs all" — including samples not listed in `assemblyNames`
 * (those mates are labelled by their PanSN prefix). `assemblyNames` therefore
 * only needs to list the assemblies you actually load into JBrowse and want the
 * track to appear on.
 *
 * A file that does not in fact contain every pair — a wfmash run with a `-p`
 * threshold, or a star-topology "everything against the reference" mapping —
 * draws an empty band for the pairs its aligner never emitted, which is
 * indistinguishable from a locus with no homology. `jbrowse transitive-paf`
 * fills those in by composing through a shared intermediate.
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
     * The assemblies this track appears on and can back synteny bands for — list
     * the assemblies you load into JBrowse. Each entry must resolve to a PanSN
     * sample (`grape`) or haplotype (`grape#1`) prefix present in the file. In a
     * plain LGV the track still draws its assembly against every other sample in
     * the file, so mates need not be listed here (unlisted mates are labelled by
     * their PanSN prefix).
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
     * Maps a JBrowse assembly name to its PanSN prefix in the PAF, for when they
     * differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need
     * `{ grape: 'Vitis_vinifera' }`). The prefix may name a sample (`grape`,
     * matching all of its haplotypes) or one haplotype (`grape#1`), so a
     * haplotype-resolved pangenome that loads each haplotype as its own assembly
     * maps `{ grape_hap1: 'grape#1', grape_hap2: 'grape#2' }`. Defaults to
     * identity: the assembly name is assumed to be the PanSN sample name.
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
