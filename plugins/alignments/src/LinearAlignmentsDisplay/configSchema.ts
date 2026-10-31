import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { baseLinearAlignmentsDisplayConfigSchema } from './baseConfigSchema.ts'
import { readsPileupConfigSchema } from './readsPileupConfigSchema.ts'
import { sashimiConfigSchema } from './sashimiConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearAlignmentsDisplay
 * #category display
 * Draws the reads of an `AlignmentsTrack` as a stack of bands: the coverage
 * histogram with the sashimi arcs over it, the read connections, and the
 * pileup. Each band is one object, `coverage`, `sashimi`, `readConnections`
 * and `pileup`, holding whether it draws and its height; the settings every
 * band shares sit beside them: `filter`, one list of the read, junction and
 * connection tests, `unit`, `facet`, `sort`, `encoding` and `legend`.
 *
 * #example
 * Minimal BAM track — no display override needed for defaults. See the
 * [alignments track guide](/docs/config_guides/alignments_track) for all
 * adapter and display options:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs_reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
 * }
 * ```
 *
 * #example
 * CRAM colored by CpG methylation (modBAM MM/ML tags). The `displayDefaults`
 * object shorthand applies settings without spelling out the display `type` or
 * `displayId` — equivalent to `displays: [{ type: 'LinearAlignmentsDisplay',
 * displayId: '...', pileup: ... }]`. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'methylation',
 *   name: 'Methylation',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
 *   displayDefaults: {
 *     pileup: {
 *       bases: {
 *         show: true,
 *         encoding: { color: 'modifications' },
 *         unmodified: { show: true },
 *       },
 *     },
 *   },
 * }
 * ```
 *
 * #example
 * Long reads — taller track, soft-clipping shown, split/chimeric reads
 * connected by arcs, each segment colored by its strand against its
 * molecule's:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'long_reads',
 *   name: 'Long reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
 *   displayDefaults: {
 *     height: 400,
 *     unit: 'chain',
 *     encoding: { color: 'insertSizeAndOrientation' },
 *     pileup: { softClips: { show: true } },
 *     readConnections: { show: true },
 *   },
 * }
 * ```
 *
 * #example
 * RNA-seq — sashimi arcs placed to avoid crossings, labelled with their read
 * counts, dropping junctions under five reads, the non-canonical ones and the
 * split-read joins:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'rnaseq',
 *   name: 'RNA-seq',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/rnaseq.bam' },
 *   displayDefaults: {
 *     coverage: { height: 80 },
 *     sashimi: { placement: 'auto', labels: { show: true } },
 *     filter: [
 *       { field: 'junction.reads', gte: 5 },
 *       { field: 'junction.canonical', equal: true },
 *       { field: 'junction.source', equal: 'gap' },
 *     ],
 *   },
 * }
 * ```
 */
export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot pileup
       * The stacked reads, with the per-base layer drawn over them,
       * whatever fills them: `bases: { show: true, encoding: { color:
       * "modifications" } }`, `"bisulfite"`, `"baseQuality"` or `"base"`.
       */
      pileup: readsPileupConfigSchema,
      /**
       * #slot sashimi
       * The splice-junction arcs, drawn in the coverage band: `show`,
       * `height`, `placement` and `labels`; the `junction` filter fields
       * filter the junctions drawn.
       */
      sashimi: sashimiConfigSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearAlignmentsDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearAlignmentsDisplayConfigSchema = ReturnType<
  typeof configSchemaFactory
>

export type LinearAlignmentsDisplayConfigModel =
  Instance<LinearAlignmentsDisplayConfigSchema>
