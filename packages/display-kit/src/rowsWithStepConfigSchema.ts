import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { rowsConfigSchema } from './rowsConfigSchema.ts'

/** `rows.step`'s word for dividing the track's height between the rows. */
export const FIT_ROWS = 'fit'

/** `rows.step` as a px row height, `0` while the rows fit. */
export function rowHeightOfStep(step: number | typeof FIT_ROWS) {
  return step === FIT_ROWS ? 0 : step
}

function refuseNonPositiveStep(snap: Record<string, unknown>) {
  const { step } = snap
  if (typeof step === 'number' && !(step > 0)) {
    throw new Error(
      `rows.step is the row height in px, above 0, or "${FIT_ROWS}" to fit the rows to the track's height, not ${step}`,
    )
  }
  return snap
}

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
    preProcessSnapshot: refuseNonPositiveStep,
  },
)
