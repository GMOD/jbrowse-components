import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { types } from '@jbrowse/mobx-state-tree'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

export const HIC_COLOR_SCALES = ['linear', 'log'] as const

export type HicColorScale = (typeof HIC_COLOR_SCALES)[number]

export const DEFAULT_HIC_COLOR_SCHEME: ColorSchemeName = 'juicebox'

/**
 * #config HicColor
 * #category display
 * The Hi-C display's `color`: how a bin's contact count becomes a colour. The
 * count runs through a `linear` or `log` scale onto a named `scheme`, whose
 * top is where the display's `useColorPercentile` saturates it.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearHicDisplay',
 *   color: { scale: 'log', scheme: 'viridis' },
 * }
 * ```
 */
export const hicColorConfigSchema = ConfigurationSchema(
  'HicColor',
  {
    /**
     * #slot scale
     * `log` places a count on the ramp by its log2, which lifts a sparse
     * file's decayed long-range bins off the floor and turns a dense file's
     * matrix solid.
     */
    scale: {
      type: 'stringEnum',
      model: types.enumeration('HicColorScale', [...HIC_COLOR_SCALES]),
      defaultValue: 'linear',
      description: 'linear, or log2 of the count',
    },
    /**
     * #slot scheme
     * The named ramp counts run across; `juicebox` fades from transparent to
     * red.
     */
    scheme: {
      type: 'stringEnum',
      model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
      defaultValue: DEFAULT_HIC_COLOR_SCHEME,
      description: 'the named ramp counts run across',
    },
    /**
     * #slot reverse
     * Runs the ramp from its last colour, so the scheme's end paints the
     * fewest contacts.
     */
    reverse: {
      type: 'boolean',
      defaultValue: false,
      description: 'run the ramp from its last colour',
    },
  },
  { closed: true },
)
