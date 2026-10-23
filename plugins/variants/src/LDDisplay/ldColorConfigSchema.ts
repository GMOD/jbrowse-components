import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import {
  colorScaleOptions,
  colorScaleTypeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { LDMetric } from '../RenderLDDataRPC/ldTypes.ts'
import type { FieldPreset } from '@jbrowse/display-kit/colorConfigSchema'

const LD_COLOR_SCALES = ['linear'] as const

/** Each metric's ramp and key title while the config leaves them unwritten. */
export const LD_FIELD_PRESETS = {
  r2: { scale: { type: 'linear', scheme: 'reds' }, legend: { title: 'R²' } },
  dprime: {
    scale: { type: 'linear', scheme: 'blues' },
    legend: { title: "D'" },
  },
} as const satisfies Record<LDMetric, FieldPreset<'linear'>>

/** The domain every LD statistic spans, and an unset end of `encoding.color`'s. */
export const LD_VALUE_EXTENT = [0, 1] as const

/**
 * #config LDColor
 * #category display
 * The LD display's `encoding.color` paints the statistic the cells show,
 * `r2` or `dprime`, through a linear scale onto a named `scale.scheme`. An
 * unset scheme is the metric's own, reds for r² and blues for D'. The domain
 * is the statistic's 0 to 1 rather than the loaded values', so one r² paints
 * one color on every track; `scale.domainMin` and `scale.domainMax` narrow
 * it. The slots are the shared color channel's, so `jbrowse validate` and
 * "Edit plot..." judge them as they judge any other display's. A string is
 * the field.
 *
 * #example
 * ```js
 * {
 *   type: 'LDTrackDisplay',
 *   encoding: {
 *     color: { field: 'dprime', scale: { scheme: 'viridis', domainMin: 0.2 } },
 *   },
 * }
 * ```
 */
export const ldColorConfigSchema = ConfigurationSchema(
  'LDColor',
  {
    /**
     * #slot field
     * The file column the cells show: `r2` (R², the R2/PHASED_R2
     * column) or `dprime` (D', the DP/ABS_DPRIME one). A file with
     * only one of the two uses that one whichever is asked for, and the
     * legend and the menu show which.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('LDColorField', ['r2', 'dprime']),
      defaultValue: 'r2',
      description: 'the statistic the cells are, r2 or dprime',
    },
    /**
     * #slot scale
     * The ramp the statistic runs along, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'LDColorScale',
      {
        ...colorScaleTypeSlot({
          scales: LD_COLOR_SCALES,
          scaleName: 'LDColorScaleType',
          type: 'linear, the one scale; unset is linear',
        }),
        /**
         * #slot scale.scheme
         */
        scheme: {
          type: 'maybeStringEnum',
          model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
          description:
            "the named ramp the statistic runs across; unset is the field's own, reds for r2 and blues for dprime",
        },
        /**
         * #slot scale.reverse
         * Unset turns round a scheme dark at its low end, since an unpainted
         * cell is the page behind the matrix.
         */
        reverse: {
          type: 'maybeBoolean',
          description:
            "turns the scheme's ramp round; unset reverses a scheme dark at its low end",
        },
        /**
         * #slot scale.domainMin
         */
        domainMin: {
          type: 'maybeNumber',
          description:
            'the value the bottom color paints, everything below it too; unset is 0',
        },
        /**
         * #slot scale.domainMax
         */
        domainMax: {
          type: 'maybeNumber',
          description:
            'the value the top color paints, everything above it too; unset is 1',
        },
      },
      colorScaleOptions('encoding.color.scale'),
    ),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
    fieldPresets: LD_FIELD_PRESETS,
  },
)
