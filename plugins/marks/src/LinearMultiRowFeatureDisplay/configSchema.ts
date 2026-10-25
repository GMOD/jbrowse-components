import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { configSchemaFactory as markConfigSchemaFactory } from '../LinearMarkDisplay/configSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearMultiRowFeatureDisplay
 * #category display
 * Colored features in stacked rows, one row per value of a feature
 * attribute: a chromosome painting, an ancestry painting, a chromatin-state
 * track per cell type. It is the mark display with a `rect` per feature as
 * its default plot, so every mark, scale, facet and row setting applies.
 *
 * With nothing declared it reads a sample of the features once: a row per
 * `repClass` where they carry one, else per `name`; each feature its file's
 * own BED color where it has one; and a feature whose children have none of
 * their own, a BED12 row or a transcript, as its blocks joined by a line.
 *
 * #example
 * A custom BED with a column naming each row, its columns named by a
 * `#`-prefixed header line (tab-separated, shown space-aligned):
 * ```text
 * #chrom  start    end      name  sample
 * chr1    0        2000000  seg1  HG00096
 * chr1    2000000  5500000  seg2  HG00096
 * chr1    0        3500000  seg3  HG00097
 * ```
 * Paint one row per `sample`, coloring each row from `rowColor` and fixing
 * HG00097 above HG00096 regardless of file order:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'ancestry_painting',
 *   name: 'Ancestry painting',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BedTabixAdapter',
 *     uri: 'https://example.com/painting.bed.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMultiRowFeatureDisplay',
 *       displayId: 'ancestry_painting-LinearMultiRowFeatureDisplay',
 *       rows: { field: 'sample', sort: ['HG00097', 'HG00096'] },
 *       rowColor: {
 *         scale: {
 *           domain: ['HG00096', 'HG00097'],
 *           range: ['#4e79a7', '#f28e2b'],
 *         },
 *       },
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * Each feature in its file's BED color, the key naming three of them:
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rows: 'sample',
 *   encoding: {
 *     color: {
 *       scale: {
 *         type: 'identity',
 *         domain: ['rgb(227,26,28)', 'rgb(31,120,180)', 'rgb(170,170,170)'],
 *         names: ['Maternal', 'Paternal', 'Unknown'],
 *       },
 *     },
 *   },
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearMultiRowFeatureDisplay',
    {
      /**
       * #slot
       * The bytes a region may download before the display asks first: a
       * painting's rows stack many features over each base.
       */
      fetchSizeLimit: {
        type: 'number',
        defaultValue: 5_000_000,
        description: 'bytes a region may download before the display asks',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: markConfigSchemaFactory(),
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
    },
  )
}

export type LinearMultiRowFeatureDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export interface LinearMultiRowFeatureDisplayConfig extends Instance<LinearMultiRowFeatureDisplayConfigModel> {}
