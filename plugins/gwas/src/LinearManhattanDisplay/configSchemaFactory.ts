import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import {
  linearMarkDisplayConfigSchemaFactory,
  markListSchema,
} from '@jbrowse/plugin-marks'

import { MANHATTAN_MARK } from './ldPlot.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearManhattanDisplay
 * #category display
 * The Manhattan plot: the default display of a GWAS track, and one a
 * FeatureTrack can switch to. It is the mark display with a point per feature
 * at its `score` as its default plot, so every mark, scale, facet and row
 * setting applies, and a plot whose encoding names `ld` or `ld_role` joins
 * each SNP's r² to the index SNP from the `GWASAdapter`'s `ldAdapter`.
 *
 * #example
 * Minimal `GWASTrack` config. See the
 * [GWAS track guide](/docs/config_guides/gwas_track) for all options:
 * ```js
 * {
 *   type: 'GWASTrack',
 *   trackId: 'gwas',
 *   name: 'GWAS results',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GWASAdapter',
 *     uri: 'https://example.com/gwas.bed.gz',
 *   },
 * }
 * ```
 *
 * #example
 * LocusZoom-style colouring: each point's r² to the index SNP in five bins,
 * the index itself a diamond. The LD data is a second source on `GWASAdapter`,
 * so it nests under `adapter`, while the plot goes in `displayDefaults`. The
 * track menu's "Color by LD to index SNP" writes the same mark:
 * ```js
 * {
 *   type: 'GWASTrack',
 *   trackId: 'gwas',
 *   name: 'GWAS results',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GWASAdapter',
 *     uri: 'https://example.com/gwas.bed.gz',
 *     ldAdapter: {
 *       type: 'PlinkLDTabixAdapter',
 *       uri: 'https://example.com/plink.ld.gz',
 *     },
 *   },
 *   displayDefaults: {
 *     height: 400,
 *     marks: [
 *       {
 *         mark: 'point',
 *         encoding: {
 *           y: 'score',
 *           color: {
 *             field: 'ld',
 *             scale: 'threshold',
 *             domain: [0.2, 0.4, 0.6, 0.8],
 *             range: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
 *             title: 'r² to index SNP',
 *           },
 *           shape: {
 *             field: 'ld_role',
 *             domain: ['index', 'partner'],
 *             range: ['diamond', 'circle'],
 *           },
 *         },
 *       },
 *     ],
 *   },
 * }
 * ```
 *
 * #example
 * A selection scan as a plain `FeatureTrack`: a point per window at its
 * `fst` column, coloured by its `population` column:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'fst_scan',
 *   name: 'Fst scan',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BedTabixAdapter',
 *     uri: 'https://example.com/fst.bed.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearManhattanDisplay',
 *       marks: [
 *         {
 *           mark: 'point',
 *           encoding: { y: 'fst', color: { field: 'population' } },
 *         },
 *       ],
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {
      ...trackHeightConfigSchemaFields(),
      /**
       * #slot marks
       * The plot, as `LinearMarkDisplay` reads it: unwritten, a point per
       * feature at its `score`.
       */
      marks: markListSchema([MANHATTAN_MARK]),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearMarkDisplayConfigSchemaFactory(),
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
    },
  )
}

export type LinearManhattanDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>

export type LinearManhattanDisplayConfig =
  Instance<LinearManhattanDisplayConfigModel>
