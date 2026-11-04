import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { FIT_ROWS } from '@jbrowse/core/util/resolveRowHeight'
import { types } from '@jbrowse/mobx-state-tree'

import { rowsConfigSchema } from './rowsConfigSchema.ts'

/**
 * #config RowsWithStep
 * #category display
 * A [Rows](../rows) whose rows can scroll: `step`, the row height, beside
 * the field, the arrangement and the axis. The mark displays' `rows`, and the
 * variant display's through [VariantRows](../variantrows). Wiggle and MAF
 * rows always fit the track and declare no `step`.
 *
 * #example
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: { field: 'sample', step: 12 } }
 * ```
 */
export const rowsWithStepConfigSchema = ConfigurationSchema(
  'RowsWithStep',
  {
    /**
     * #slot step
     * Row height in px: the px from one row's top to the next, the rows that
     * do not fit scrolling; or `"fit"`, the default, dividing the track's
     * `height` between the rows, as `heightMode: "fit"` does on a feature
     * track. The track never grows to hold its rows. Vega-Lite's word for a
     * band's size, as in `height: { step }`.
     */
    step: {
      type: 'number',
      model: types.union(types.number, types.literal(FIT_ROWS)),
      defaultValue: FIT_ROWS,
      exclusiveMinimum: 0,
      description:
        'row height in px, the rows that do not fit scrolling; or "fit" (the default) to divide the track height between the rows, as heightMode "fit" does on a feature track',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowsConfigSchema,
    misnamed: { height: 'step' },
  },
)
