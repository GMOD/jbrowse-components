import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import {
  linearMarkDisplayConfigSchemaFactory,
  markListSchema,
} from '@jbrowse/plugin-marks'

import { MANHATTAN_MARK } from './ldPlot.ts'

/**
 * #config LinearManhattanDisplay
 * #category display
 * The Manhattan plot: the default display of a GWAS track, and one a
 * FeatureTrack can switch to. It is the mark display with a point per feature
 * at its `score` as its default plot, so every mark, scale, facet and row
 * setting applies, and a plot whose encoding names `r2` or `ld_role` joins
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
 * LocusZoom-style coloring by r² to the index SNP. The LD data is a second
 * source on `GWASAdapter`, so it nests under `adapter`; the track menu's
 * "Color by LD to index SNP" then writes the plot, and the
 * [GWAS track guide](/docs/config_guides/gwas_track#example) writes it out in
 * `displayDefaults`:
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
 * }
 * ```
 *
 * #example
 * A selection scan as a plain `FeatureTrack`: a point per window at its
 * `fst` column, colored by its `population` column:
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
