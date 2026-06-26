import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { defaultFilterFlags } from '../shared/util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearAlignmentsDisplay
 * #category display
 * configuration schema for the LinearAlignmentsDisplay
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
 * displayId: '...', colorBy: ... }]`. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'methylation',
 *   name: 'Methylation',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
 *   displayDefaults: { colorBy: { type: 'methylation' } },
 * }
 * ```
 *
 * #example
 * Long reads — taller track, soft-clipping shown, split/chimeric reads
 * connected by arcs:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'long_reads',
 *   name: 'Long reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
 *   displayDefaults: {
 *     height: 400,
 *     showSoftClipping: true,
 *     linkedReads: 'normal',
 *     readConnections: 'arc',
 *   },
 * }
 * ```
 */
export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot
       */
      featureHeight: {
        type: 'number',
        defaultValue: 7,
        description: 'Height of each feature (read) in pixels',
      },
      /**
       * #slot
       */
      featureSpacing: {
        type: 'number',
        defaultValue: 1,
        description: 'Spacing between features in pixels',
      },
      /**
       * #slot
       */
      readConnectionsLineWidth: {
        type: 'number',
        defaultValue: 1,
        description: 'Line width for read-connection arcs/lines in pixels',
      },
      /**
       * #slot
       */
      showSashimiLabels: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw the supporting-read count on each sashimi arc',
      },
      /**
       * #slot
       */
      maxHeight: {
        type: 'number',
        defaultValue: 6000,
        description:
          'Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)',
        advanced: true,
      },
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 250,
      },
      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        defaultValue: { type: 'normal' },
        description: 'Color scheme for reads',
        advanced: true,
      },
      /**
       * #slot
       * default filter flags is exclude 1540
       * read unmapped (0x4)
       * read fails platform/vendor quality checks (0x200)
       * read is PCR or optical duplicate (0x400)
       */
      filterBy: {
        type: 'frozen',
        defaultValue: defaultFilterFlags,
        description: 'Filter settings for reads',
        advanced: true,
      },
      /**
       * #slot
       */
      groupBy: {
        type: 'frozen',
        defaultValue: null,
        description:
          'In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)',
        advanced: true,
      },
      /**
       * #slot
       */
      autoscale: {
        type: 'stringEnum',
        model: types.enumeration('Coverage autoscale type', [
          'local',
          'localsd',
        ]),
        defaultValue: 'local',
        description: 'Coverage autoscale type',
      },
      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'Minimum coverage depth bound',
        advanced: true,
      },
      /**
       * #slot
       */
      maxScore: {
        type: 'number',
        defaultValue: Number.MAX_VALUE,
        description: 'Maximum coverage depth bound',
        advanced: true,
      },
      /**
       * #slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Coverage scale type', ['linear', 'log']),
        defaultValue: 'linear',
        description: 'Coverage scale type (linear or log)',
      },
      /**
       * #slot
       */
      numStdDev: {
        type: 'number',
        defaultValue: 3,
        description: 'Number of standard deviations for localsd autoscale',
        advanced: true,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearAlignmentsDisplayConfigModel = Instance<
  ReturnType<typeof configSchemaFactory>
>
