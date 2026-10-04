import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import {
  colorChannelSlots,
  colorDomainEndsSlots,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { FieldPresets } from '@jbrowse/display-kit/colorConfigSchema'

export const HIC_COLOR_SCALES = ['linear', 'log'] as const

export type HicColorScale = (typeof HIC_COLOR_SCALES)[number]

/** A bin's contact count, the one thing Hi-C's colour maps. */
export const HIC_COLOR_FIELD = 'count'

/** `count` runs along a linear ramp while `scale` is unset. */
export const HIC_FIELD_PRESETS = {
  [HIC_COLOR_FIELD]: { scale: 'linear' },
} as const satisfies FieldPresets<HicColorScale>

export const DEFAULT_HIC_COLOR_SCHEME: ColorSchemeName = 'juicebox'

/**
 * #config HicColor
 * #category display
 * The Hi-C display's `color`: a bin's contact count through a `linear` or
 * `log` scale onto a named `scheme`. An unset `domainMax` follows the loaded
 * counts, saturating at their `domainQuantile`, the 95th percentile by
 * default, or at their maximum at a quantile of 1; setting it gives every
 * zoom, and every track that sets the same number, one scale. The slots are
 * the shared colour object's, so `jbrowse validate` and "Edit plot..." judge
 * them as they judge any other display's.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearHicDisplay',
 *   color: { scale: 'log', scheme: 'viridis', domainMax: 500 },
 * }
 * ```
 */
export const hicColorConfigSchema = ConfigurationSchema(
  'HicColor',
  {
    ...colorChannelSlots({
      scales: HIC_COLOR_SCALES,
      scaleName: 'HicColorScale',
      fieldType: 'string',
      field: "count, each bin's contact count",
      fieldDefault: 'count',
      scale:
        'linear, or log2 of the count, which lifts sparse long-range bins off the floor; unset is linear',
    }),
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
      type: 'stringEnum',
      model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
      defaultValue: DEFAULT_HIC_COLOR_SCHEME,
      description:
        'the named ramp counts run across; juicebox fades from transparent to red',
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
    ...colorDomainEndsSlots,
    /**
     * #slot domainMin
     */
    domainMin: {
      type: 'maybeNumber',
      description: 'the bottom of the scale; unset is 0',
    },
    /**
     * #slot domainQuantile
     * What an unset `domainMax` follows: the loaded counts' quantile, `0.95`
     * so faint off-diagonal contacts read, or at `1` their maximum. The track
     * menu's "Emphasize faint contacts" toggles it. The same word every colour
     * ramp and `scales.y` take.
     */
    domainQuantile: {
      type: 'number',
      defaultValue: 0.95,
      description:
        'the quantile of the loaded counts an unset domainMax follows; 1 is their maximum',
    },
  },
  { closed: true, fieldPresets: HIC_FIELD_PRESETS },
)
