import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorRampSlots,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config WiggleColor
 * #category display
 * The quantitative display's `color`: one CSS colour for every bar, or a
 * field through a scale. `score` through a `threshold` scale is the bicolor
 * plot — one cut point, one colour each side, the `origin` where the domain
 * names none — and through `linear` or `log` it is the density ramp.
 * `source` through a `categorical` scale gives each subtrack a range colour,
 * which is what several sources sharing one plot box need to be told apart.
 * A wiggle colours per signal rather than per feature, so a `jexl:` callback
 * over a feature has nothing to read here.
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
      field:
        'score, the value each bar carries, or source, the subtrack it came from',
      scale:
        'how field becomes a colour: threshold cuts score at the domain and paints each side; linear and log fade from the colour at domainMid out to the ends of the y domain, which is the density picture, through range, else scheme, else the two-sided fade; categorical hands each source a range colour; none paints value, keeping a field for a switch back; unset beside a field, it is categorical over source and threshold over score',
    }),
    ...colorDomainSlot({
      domain:
        'for a threshold scale, the one cut point the two sides part at, empty meaning the origin; for a categorical scale over source, the sources that take the range first, in order',
    }),
    ...colorRangeSlot({
      range:
        "a threshold scale's colour below the cut and at or above it; a categorical scale's colour per source, continuing into the default palette; a linear or log scale's stops, evenly spaced",
    }),
    ...colorRampSlots,
  },
  colorChannelOptions('color'),
)
