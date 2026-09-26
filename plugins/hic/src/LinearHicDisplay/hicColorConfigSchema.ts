import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { colorDomainEndsSlots } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

export const HIC_COLOR_SCALES = ['linear', 'log'] as const

export type HicColorScale = (typeof HIC_COLOR_SCALES)[number]

export const DEFAULT_HIC_COLOR_SCHEME: ColorSchemeName = 'juicebox'

/**
 * #config HicColor
 * #category display
 * The Hi-C display's `color`: a bin's contact count through a `linear` or
 * `log` scale onto a named `scheme`. An unset `domainMax` follows the loaded
 * counts, saturating at their `domainQuantile`, the 95th percentile by
 * default, or at their maximum at a quantile of 1; setting it gives every
 * zoom, and every track that sets the same number, one scale.
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
    /**
     * #slot scale
     */
    scale: {
      type: 'stringEnum',
      model: types.enumeration('HicColorScale', [...HIC_COLOR_SCALES]),
      defaultValue: 'linear',
      description:
        'linear, or log2 of the count, which lifts sparse long-range bins off the floor',
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
  { closed: true },
)
