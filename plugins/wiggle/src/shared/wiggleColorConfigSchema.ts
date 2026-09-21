import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorRampSlots,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/** The two things a quantitative display's colour can map. */
export const WIGGLE_COLOR_FIELDS = ['score', 'source'] as const

export const SOURCE_FIELD = 'source'

/**
 * #config WiggleColor
 * #category display
 * The quantitative display's `color`: one CSS colour for every bar, or one of
 * its two fields through a scale. `score` through a `threshold` scale is the
 * bicolor plot — one cut point, one colour each side, the `origin` where the
 * domain names none — and through `linear` or `log` it is the density ramp.
 * `source` through a `categorical` scale gives each subtrack a colour of its
 * own, which is what several sources sharing one plot box need to be told
 * apart. Any other pairing paints the misconfiguration grey. A wiggle colours
 * per signal rather than per feature, so a `jexl:` callback over a feature has
 * nothing to read here.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', color: 'darkgreen' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   color: { field: 'score', scale: 'threshold', domain: [2], range: ['#2166ac', '#b2182b'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   defaultRendering: 'density',
 *   color: { field: 'score', scale: 'linear', scheme: 'viridis' },
 * }
 * ```
 */
export const wiggleColorSchema = ConfigurationSchema(
  'WiggleColor',
  {
    /**
     * #slot value
     * One CSS colour for every bar. Writing `color: "darkgreen"` lands here.
     * Unset, the display paints the picture its layout asks for: a palette
     * entry per source where several share one plot box, and the pos/neg pair
     * about the `origin` otherwise.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS colour painting every bar',
    },
    ...colorChannelSlots({
      scales: COLOR_SCALES,
      scaleName: 'WiggleColorScale',
      fieldType: 'string',
      field: 'score or source',
      scale:
        'how field becomes a colour: threshold cuts score at its lowest cut and paints each side; linear and log fade from the colour at domainMid out to the ends of the y domain, which is the density picture, through range, else scheme, else the two-sided fade; categorical hands each source a colour of its own; a scale over the other field paints grey; none paints value, keeping a field for a switch back; unset beside a field, it is categorical over source and threshold over score',
    }),
    /**
     * #slot field
     * `score`, the value each bar carries, or `source`, the subtrack it came
     * from. Unset, the colour paints `value`.
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorField', [...WIGGLE_COLOR_FIELDS]),
      description:
        'score, the value each bar carries, or source, the subtrack it came from',
    },
    ...colorDomainSlot({
      domain:
        'for a threshold scale, the cut point the two sides part at, the lowest where it lists several, empty meaning the origin; for a categorical scale over source, the subtracks outside a group that take the range first, in order',
    }),
    ...colorRangeSlot({
      range:
        "a threshold scale's colour below the cut and at or above it; the colours a categorical scale over source hands to the subtrack groups first and then to each subtrack, continuing into the default palette; a linear or log scale's stops, evenly spaced",
    }),
    ...colorRampSlots,
  },
  colorChannelOptions('color'),
)
