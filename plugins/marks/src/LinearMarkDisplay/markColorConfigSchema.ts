import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import {
  COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorPaletteSlot,
  colorRampSlot,
  paintedScale,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { ColorScaleName } from '@jbrowse/display-kit/colorConfigSchema'

export type MarkColorScale = ColorScaleName

/**
 * The scale a mark's colour paints through: left unset beside a `field`,
 * `linear` with a `ramp` and `categorical` without.
 */
export function markColorScale(color: {
  scale: MarkColorScale | undefined
  field: string
  ramp: readonly string[]
}) {
  return paintedScale(color, color.ramp.length > 0 ? 'linear' : 'categorical')
}

/**
 * #config MarkColor
 * #category display
 * A mark's `encoding.color`: one CSS colour or `jexl:` callback for every
 * instance, or a field through a categorical scale (a palette colour per
 * value), a `linear` or `log` scale (a ramp over `domain`) or a `threshold`
 * scale (a palette colour per interval between the cut points `domain`
 * lists). A string is the constant; the object binds the field, and a scale
 * is what the legend describes.
 *
 * #example
 * ```js
 * { shape: 'bar', encoding: { y: 'score', color: 'steelblue' } }
 * ```
 * ```js
 * {
 *   shape: 'point',
 *   encoding: { y: 'score', color: { field: 'strand', domain: ['1', '-1'] } },
 * }
 * ```
 * ```js
 * {
 *   shape: 'span',
 *   encoding: {
 *     color: { field: 'score', scale: 'log', domain: [1, 1000], ramp: ['white', 'red'] },
 *   },
 * }
 * ```
 * ```js
 * {
 *   shape: 'point',
 *   encoding: {
 *     y: 'score',
 *     color: {
 *       field: 'pip',
 *       scale: 'threshold',
 *       domain: [0.1, 0.5],
 *       palette: ['#357ebd', '#eea236', '#d43f3a'],
 *     },
 *   },
 * }
 * ```
 */
export const markColorSchema = ConfigurationSchema(
  'MarkColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one, for a
     * mark whose colour is not a scale. Writing `color: 'red'` or
     * `color: 'jexl:…'` directly on the encoding lands here.
     */
    value: {
      type: 'color',
      defaultValue: DEFAULT_MARK_COLOR,
      description: 'CSS colour or jexl callback',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: COLOR_SCALES,
      scaleName: 'MarkColorScale',
      field:
        'the feature field a scale reads, or a jexl callback over feature, which is slower per feature and so the opt-in',
      scale:
        'how field becomes a colour: categorical hands out palette entries per distinct value; linear and log read the value through domain into ramp; threshold cuts the value at the domain and hands each interval a palette entry; none paints value, keeping a field for a switch back; unset beside a field, it is linear with a ramp and categorical without',
      domain:
        "for a categorical scale, the values in legend order, walking the palette from the first entry and continuing into the default palette past its end (a value left out derives its colour from itself and never takes a listed value's, so every region agrees); for a linear or log scale, the [min, max] the ramp spans, empty using each region's own extremes; for a threshold scale, the cut points in ascending order, a value taking the palette entry for the number of them it is at or past",
    }),
    ...colorPaletteSlot(
      'CSS colors the domain values take, in order, continuing into the default palette past its end; under a threshold scale one colour per interval, so one more entry than domain',
    ),
    ...colorRampSlot,
  },
  colorChannelOptions('color'),
)
