import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { colorRampSlots } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { MatrixFieldPresets } from '@jbrowse/display-kit/MatrixRampMixin'

export const HIC_COLOR_SCALES = ['linear', 'symlog', 'log'] as const

export type HicColorScale = (typeof HIC_COLOR_SCALES)[number]

/** A bin's contact count, the one thing Hi-C's color maps. */
export const HIC_COLOR_FIELD = 'count'

export const DEFAULT_HIC_COLOR_SCHEME: ColorSchemeName = 'juicebox'

/** `count` runs along a linear juicebox ramp while `scale` and `scheme` are unset. */
export const HIC_FIELD_PRESETS = {
  [HIC_COLOR_FIELD]: { scale: 'linear', scheme: DEFAULT_HIC_COLOR_SCHEME },
} as const satisfies MatrixFieldPresets<typeof HIC_COLOR_FIELD>

/**
 * #config HicColor
 * #category display
 * The Hi-C display's `color`: a bin's contact count through a `linear`,
 * `symlog` or `log` scale onto a named `scheme`. An unset `domainMax` follows the loaded
 * counts, saturating at their `domainQuantile`, the 95th percentile by
 * default, or at their maximum at a quantile of 1; setting it gives every
 * zoom, and every track that sets the same number, one scale. The slots are
 * the shared color object's, so `jbrowse validate` and "Edit plot..." judge
 * them as they judge any other display's.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearHicDisplay',
 *   color: { scale: 'symlog', scheme: 'viridis', domainMax: 500 },
 * }
 * ```
 */
export const hicColorConfigSchema = ConfigurationSchema(
  'HicColor',
  {
    /**
     * #slot field
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('HicColorField', [HIC_COLOR_FIELD]),
      defaultValue: HIC_COLOR_FIELD,
      description: "count, each bin's contact count",
    },
    /**
     * #slot scheme
     */
    scheme: {
      type: 'maybeStringEnum',
      model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
      description:
        "the named ramp the field runs across; unset is the field's own, juicebox for count, which fades from transparent to red",
    },
    /**
     * #slot reverse
     * Unset turns round a scheme dark at its low end, since an unpainted bin
     * is the page behind the matrix.
     */
    reverse: {
      type: 'maybeBoolean',
      description:
        "turns the scheme's ramp round; unset reverses a scheme dark at its low end",
    },
    /**
     * #slot domainMid
     * The value the ramp's middle stop sits at, so a diverging scheme centres
     * on it and equal distances from it take equal colors; unset, the stops
     * spread evenly across the domain.
     */
    domainMid: colorRampSlots.domainMid,
    /**
     * #slot domainMin
     */
    domainMin: {
      type: 'maybeNumber',
      description: 'the bottom of the scale; unset is 0',
    },
    /**
     * #slot domainQuantile
     * The value an unset `domainMax` follows: the loaded counts' quantile, `0.95`
     * so faint off-diagonal contacts read, or at `1` their maximum. The track
     * menu's "Emphasize faint contacts" toggles it. Every color ramp reads
     * the word this way; `scales.y` reads it as an outlier fence.
     */
    domainQuantile: {
      type: 'number',
      defaultValue: 0.95,
      description:
        'the quantile of the loaded counts an unset domainMax follows; 1 is their maximum',
    },
    /**
     * #slot scale
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('HicColorScale', [...HIC_COLOR_SCALES]),
      description:
        "linear; symlog, d3's log(1 + count), which the Log scale toggle writes: it lifts sparse long-range bins off the floor and leaves only 0 transparent; or log, log2 of the count from a pinned domainMin or else 1, every bin at or below which draws transparent. Unset is linear",
    },
    /**
     * #slot domainMax
     */
    domainMax: {
      type: 'maybeNumber',
      description:
        "the top of the scale's domain; unset follows the loaded counts",
    },
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
    fieldPresets: HIC_FIELD_PRESETS,
  },
)
