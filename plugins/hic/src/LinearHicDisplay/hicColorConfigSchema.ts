import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import {
  colorDomainEndsSlots,
  colorReverseSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
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
 * counts, saturating where the display's `useColorPercentile` says; setting it
 * gives every zoom, and every track that sets the same number, one scale.
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
    ...colorReverseSlot,
    ...colorDomainEndsSlots,
  },
  { closed: true },
)
