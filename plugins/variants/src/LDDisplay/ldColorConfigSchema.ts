import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { types } from '@jbrowse/mobx-state-tree'

import type { LDMetric } from '../VariantRPC/ldTypes.ts'
import type { FieldPreset } from '@jbrowse/display-kit/colorConfigSchema'

const LD_COLOR_SCALES = ['linear'] as const

/** Each metric's ramp and key title while the config leaves them unwritten. */
export const LD_FIELD_PRESETS = {
  r2: { scale: 'linear', scheme: 'reds', title: 'R²' },
  dprime: { scale: 'linear', scheme: 'blues', title: "D'" },
} as const satisfies Record<LDMetric, FieldPreset<'linear'>>

/** The domain every LD statistic spans, and an unset end of `color`'s. */
export const LD_VALUE_EXTENT = [0, 1] as const

/**
 * #config LDColor
 * #category display
 * The LD display's `color`: which statistic the cells are, `r2` or `dprime`,
 * through a linear scale onto a named `scheme`. An unset `scheme` is the
 * metric's own, reds for r² and blues for D'. The domain is the statistic's
 * 0 to 1 rather than the loaded values', so one r² paints one color on every
 * track; `domainMin` and `domainMax` narrow it. The slots are the shared
 * color object's, so `jbrowse validate` and "Edit plot..." judge them as they
 * judge any other display's.
 *
 * #example
 * ```js
 * {
 *   type: 'LDTrackDisplay',
 *   color: { field: 'dprime', scheme: 'viridis', domainMin: 0.2 },
 * }
 * ```
 */
export const ldColorConfigSchema = ConfigurationSchema(
  'LDColor',
  {
    /**
     * #slot field
     * Which of the file's columns the cells are: `r2` (R², the R2/PHASED_R2
     * column) or `dprime` (D', the DP/ABS_DPRIME one). A file that carries
     * only one of the two serves that one whichever is asked for, and the
     * legend and the menu say which.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('LDColorField', ['r2', 'dprime']),
      defaultValue: 'r2',
      description: 'the statistic the cells are, r2 or dprime',
    },
    /**
     * #slot scheme
     */
    scheme: {
      type: 'maybeStringEnum',
      model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
      description:
        "the named ramp the statistic runs across; unset is the field's own, reds for r2 and blues for dprime",
    },
    /**
     * #slot reverse
     * Unset turns round a scheme dark at its low end, since an unpainted cell
     * is the page behind the matrix.
     */
    reverse: {
      type: 'maybeBoolean',
      description:
        "turns the scheme's ramp round; unset reverses a scheme dark at its low end",
    },
    /**
     * #slot domainMin
     */
    domainMin: {
      type: 'maybeNumber',
      description:
        'the value the bottom color paints, everything below it too; unset is 0',
    },
    /**
     * #slot domainMax
     */
    domainMax: {
      type: 'maybeNumber',
      description:
        'the value the top color paints, everything above it too; unset is 1',
    },
    /**
     * #slot scale
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('LDColorScale', [...LD_COLOR_SCALES]),
      description: 'linear, the one scale; unset is linear',
    },
  },
  { shorthand: 'field', closed: true, fieldPresets: LD_FIELD_PRESETS },
)
