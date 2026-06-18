import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearAlignmentsDisplay
 * #category display
 * configuration schema for the LinearAlignmentsDisplay
 *
 * #example
 * The display goes in a track's `displays` array; here are three complete
 * `AlignmentsTrack` configs to paste into `tracks`.
 *
 * Basic BAM, opened taller:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs_reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
 *   displays: [
 *     {
 *       type: 'LinearAlignmentsDisplay',
 *       displayId: 'ngs_reads-LinearAlignmentsDisplay',
 *       height: 250,
 *     },
 *   ],
 * }
 * ```
 *
 * CRAM colored by CpG methylation (modBAM MM/ML tags):
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'methylation',
 *   name: 'Methylation',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
 *   displays: [
 *     {
 *       type: 'LinearAlignmentsDisplay',
 *       displayId: 'methylation-LinearAlignmentsDisplay',
 *       colorBy: { type: 'methylation' },
 *     },
 *   ],
 * }
 * ```
 *
 * Long reads with soft-clipping shown and split/mate reads connected by arcs:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'long_reads',
 *   name: 'Long reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
 *   displays: [
 *     {
 *       type: 'LinearAlignmentsDisplay',
 *       displayId: 'long_reads-LinearAlignmentsDisplay',
 *       height: 400,
 *       showSoftClipping: true,
 *       linkedReads: 'normal',
 *       readConnections: 'arc',
 *     },
 *   ],
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
       */
      filterBy: {
        type: 'frozen',
        defaultValue: {
          flagInclude: 0,
          flagExclude: 1540,
        },
        description: 'Filter settings for reads',
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
