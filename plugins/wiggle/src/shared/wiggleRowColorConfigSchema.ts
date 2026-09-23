import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorDomainSlot,
  colorRangeSlot,
  normalizeChannel,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config WiggleRowColor
 * #category display
 * The quantitative display's `rowColor`: the colour a reader set on a named
 * subtrack in the arrangement dialog, as `domain`/`range` pairs. It paints the
 * row's identity where the display paints one per row — its plot, or under a
 * score gradient the tint beside its label — ahead of the colour the adapter
 * supplied and the palette a group or an overlaid source is dealt.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rowColor: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
 * }
 * ```
 */
export const wiggleRowColorSchema = ConfigurationSchema(
  'WiggleRowColor',
  {
    ...colorDomainSlot({
      domain: 'the subtracks given a colour of their own, by name',
    }),
    ...colorRangeSlot({
      range: 'the CSS colour each subtrack in domain takes, in the same order',
    }),
  },
  {
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'rowColor'),
  },
)

/** The colour `rowColor` sets on each named row. */
export function rowColorsOf({
  domain,
  range,
}: {
  domain: readonly string[]
  range: readonly string[]
}): ReadonlyMap<string, string> {
  const colors = new Map<string, string>()
  domain.forEach((name, i) => {
    const color = range[i]
    if (color !== undefined) {
      colors.set(name, color)
    }
  })
  return colors
}
