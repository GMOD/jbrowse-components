import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  configSchemaFactory as markConfigSchemaFactory,
  markListSchema,
} from '../LinearMarkDisplay/configSchema.ts'
import { multiRowTooltipConfigSchema } from '../LinearMarkDisplay/markTooltipConfigSchema.ts'
import { multiRowRowsConfigSchema } from './multiRowRowsConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearMultiRowFeatureDisplay
 * #category display
 * Colored features in stacked rows, one row per value of a feature
 * attribute: a chromosome painting, an ancestry painting, a chromatin-state
 * track per cell type. It is the mark display with a `rect` per feature as
 * its plot, so every mark, scale, facet and row setting applies.
 *
 * It draws what the config states and saves no guess. Rows: one per value
 * of `rows.field`, whose declared default is `type`, so a GFF3 draws a row per
 * feature type and a ClinVar bigBed a row per variant type. `rows: 'sample'`
 * or `rows: { field: 'sample', ... }` overrides it, as the examples write, and
 * `rows: ''` is one row. Where no feature in view carries the field in force,
 * as a plain BED carries no `type`, the features draw in the one row of no
 * value and the display opens the track menu's One row per picker once,
 * listing the attributes the features in view carry. Color: a stated `rows.colors` entry, else each feature's own BED
 * color (`itemRgb`, a bigBed's `reserved`, a BED9's ninth column), else the
 * default; a placeholder `0` or `0,0,0` reads as no color. A key appears only
 * where a color names its values: a field, or an identity scale's `domain`
 * and `names`, as the second example writes. Shape: one `rect` per feature;
 * "Edit plot..." offers a BED12 row's blocks joined by a line, and a
 * transcript with its protein domains over it.
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
 * Paint one row per `sample`, pinning each row's color in `rows.colors` and fixing
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
 *       rows: {
 *         field: 'sample',
 *         sort: ['HG00097', 'HG00096'],
 *         colors: { HG00096: '#4e79a7', HG00097: '#f28e2b' },
 *       },
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * The `rows` shorthand, a row per `sample`, and each feature in its file's
 * BED color, with a key naming three of them;
 * where black is a color the file means, the written identity scale also
 * paints `0,0,0` as black:
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
 *
 * #example
 * One row, written so the `type` default does not split the features:
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: '' }
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
      /**
       * #slot marks
       * The plot, as `LinearMarkDisplay` reads it: unwritten, a `rect` per
       * feature.
       */
      marks: markListSchema([{ mark: 'rect' }]),
      /**
       * #slot rows
       * The rows, a [MultiRowRows](../multirowrows): a row per value of
       * `field`, `type` unless written, and `''` for one row.
       */
      rows: multiRowRowsConfigSchema,
      /**
       * #slot tooltip
       * The box hovering a feature opens, a
       * [MultiRowTooltip](../multirowtooltip): its first line names the
       * feature, `_mouseOver`, else the name, `function` or ID, unless
       * `field` says otherwise.
       */
      tooltip: multiRowTooltipConfigSchema,
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
