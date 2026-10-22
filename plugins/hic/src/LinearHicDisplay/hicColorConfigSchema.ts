import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { colorRampSlots } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { MatrixFieldPresets } from '@jbrowse/display-kit/MatrixRampMixin'

export const HIC_COLOR_SCALES = ['linear', 'symlog', 'log'] as const

export type HicColorScale = (typeof HIC_COLOR_SCALES)[number]

/**
 * What a bin's color maps, in Juicebox's names: its contact count, or that
 * count over the count expected at its distance.
 */
export const HIC_COLOR_FIELDS = ['observed', 'observed/expected'] as const

export type HicColorField = (typeof HIC_COLOR_FIELDS)[number]

export const DEFAULT_HIC_COLOR_SCHEME: ColorSchemeName = 'juicebox'

/**
 * Each field's ramp while the config leaves it unwritten. A ratio diverges
 * around 1 on a log scale over a fixed quarter to fourfold, so two tracks, and
 * two conditions, read one color for one ratio; enrichment paints red.
 */
export const HIC_FIELD_PRESETS = {
  observed: { scale: 'linear', scheme: DEFAULT_HIC_COLOR_SCHEME },
  'observed/expected': {
    scale: 'log',
    scheme: 'redblue',
    reverse: true,
    domainMin: 0.25,
    domainMax: 4,
    domainMid: 1,
  },
} as const satisfies MatrixFieldPresets<HicColorField>

/**
 * #config HicColor
 * #category display
 * The Hi-C display's `color`: a bin's `observed` contact count, or its
 * `observed/expected` ratio, through a `linear`, `symlog` or `log` scale onto
 * a named `scheme`.
 *
 * - `observed`: an unset `domainMax` follows the loaded counts, saturating at
 *   their `domainQuantile`, the 95th percentile by default, or at their
 *   maximum at a quantile of 1. Setting it gives every zoom, and every track
 *   that sets the same number, one scale.
 * - `observed/expected`: each count over the file's expected count at that
 *   distance, the view Juicebox calls O/E, which shows compartments and loops
 *   under the decay of contact with distance. It diverges around 1 from a
 *   quarter to fourfold, and where the file has no expected values at the
 *   binsize, the display paints the counts and the key says so.
 *
 * The slots are the shared color object's, so `jbrowse validate` and "Edit
 * plot..." judge them as they judge any other display's.
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
      model: types.enumeration('HicColorField', [...HIC_COLOR_FIELDS]),
      defaultValue: 'observed',
      description:
        "observed, each bin's contact count, or observed/expected, that count over the file's expected count at its distance",
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
