import { fillLocations } from '@jbrowse/core/configuration'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MultiGenomePAFAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Multi-genome PAF | PanSN-prefixed; one file backs every pair in a multi-way view
 * Loads a single PAF holding alignments among several genomes, where every
 * sequence name is PanSN-prefixed with its assembly (`sample#haplotype#contig`).
 * The file may state any set of pairs: a complete all-vs-all (`minimap2 all.fa
 * all.fa`, or the PGGB mapping step), or a star of many haplotypes against one
 * reference (as HPRC publishes against GRCh38). One file (and one track) then
 * backs every synteny band of a multi-way view: the synteny view tells the
 * adapter which pair a given band draws, and the adapter keeps only those
 * records, stripping the PanSN prefix to recover each assembly's own refName. A
 * band between two assemblies the file never aligns says so rather than drawing
 * empty. In a plain LGV (LGVSyntenyDisplay) there is no band to isolate, so the
 * track draws its assembly against every OTHER sample in the file — "one vs
 * all" — including samples not listed in `assemblyNames` (those mates are
 * labelled by their PanSN prefix). `assemblyNames` therefore only needs to list
 * the assemblies you actually load into JBrowse and want the track to appear
 * on.
 *
 * Registered before 2026-09 as `AllVsAllPAFAdapter`, which a config may still
 * say.
 *
 * #example
 * ```js
 * {
 *   type: 'MultiGenomePAFAdapter',
 *   uri: 'all_vs_all.paf.gz',
 *   assemblyNames: ['grape', 'peach', 'cacao'],
 * }
 * ```
 */
const MultiGenomePAFAdapter = ConfigurationSchema(
  'MultiGenomePAFAdapter',
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
     *   "type": "MultiGenomePAFAdapter",
     *   "uri": "file.paf.gz",
     *   "assemblyNames": ["grape", "peach"]
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? fillLocations(snap, {
            pafLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          })
        : snap
    },
  },
)

export type MultiGenomePAFAdapterConfig = Instance<typeof MultiGenomePAFAdapter>

export default MultiGenomePAFAdapter
