import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'pifGzLocation')
}

/**
 * #config MultiGenomeIndexedPAFAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Multi-genome indexed PAF (PIF) | The tabix-indexed form of multi-genome PAF
 * The tabix-indexed (PIF) form of the `MultiGenomePAFAdapter`. Run
 * `jbrowse make-pif all_vs_all.paf` on a multi-genome PAF whose sequence names
 * are PanSN-prefixed (`sample#haplotype#contig`) and point this adapter at the
 * resulting `.pif.gz`. Because PIF double-emits each record keyed on both of its
 * PanSN sequence names, a region query resolves to a tabix range lookup on the
 * anchor's PanSN seqid(s) instead of scanning the whole file — so it scales to
 * whole-genome pangenome alignments that do not fit in memory. Semantics match
 * `MultiGenomePAFAdapter`: the file may state any set of pairs (a complete
 * all-vs-all or a star against one reference), one-vs-all in a plain LGV,
 * single-pair when the synteny view supplies a `targetAssemblyName`.
 *
 * Registered before 2026-09 as `AllVsAllIndexedPAFAdapter`, which a config may
 * still say.
 *
 * #example
 * ```js
 * {
 *   type: 'MultiGenomeIndexedPAFAdapter',
 *   uri: 'all_vs_all.pif.gz',
 *   assemblyNames: ['grape', 'peach', 'cacao'],
 * }
 * ```
 */
const MultiGenomeIndexedPAFAdapter = ConfigurationSchema(
  'MultiGenomeIndexedPAFAdapter',
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
     */
    pifGzLocation: {
      type: 'fileLocation',
      description: 'location of the multi-genome tabix indexed PAF (pif)',
      defaultValue: {
        uri: '/path/to/all_vs_all.pif.gz',
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
    /**
     * #slot
     * bpPerPx threshold at which a view on "Level of detail: automatic" switches
     * from the per-row CIGAR tier (lowercase t/q prefix) to the coarse tier
     * (uppercase T/Q prefix), whose CIGAR is folded to its large indels. The
     * file has the last word: one with no coarse tier (make-pif --no-coarse)
     * serves the fine tier at every zoom, and a threshold below the `--coarse`
     * bound its `#pif` header states is raised to that bound, since below it the
     * coarse tier is served at zooms where the indels it folded away are wide
     * enough to see.
     */
    coarseBpPerPxThreshold: {
      type: 'number',
      defaultValue: 10000,
      advanced: true,
    },
    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
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
     *   "type": "MultiGenomeIndexedPAFAdapter",
     *   "uri": "all_vs_all.pif.gz",
     *   "assemblyNames": ["grape", "peach", "cacao"]
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type MultiGenomeIndexedPAFAdapterConfig = Instance<
  typeof MultiGenomeIndexedPAFAdapter
>

export default MultiGenomeIndexedPAFAdapter
