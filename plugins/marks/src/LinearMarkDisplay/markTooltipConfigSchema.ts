import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { featureTooltipFieldSlot } from '@jbrowse/plugin-features'

const showSlot = {
  type: 'boolean',
  defaultValue: true,
  description: 'open the tooltip when the cursor rests on a mark',
} as const

/**
 * #config MarkTooltip
 * #category display
 * The mark display's `tooltip`, the box hovering a mark opens: whether it
 * `show`s, and the `field` naming the hovered feature on its first line,
 * above the locus and each channel's value. A bare string is the field.
 * Unwritten, the field is empty and the box names no feature, so a plot of
 * dense values, a Manhattan or a coverage, ships no string per mark.
 *
 * #example
 * ```js
 * { type: 'LinearMarkDisplay', tooltip: 'name' }
 * ```
 */
export const markTooltipConfigSchema = ConfigurationSchema(
  'MarkTooltip',
  {
    /**
     * #slot
     * Off, hovering a mark opens no box.
     */
    show: showSlot,
    /**
     * #slot
     * The field the box's first line reads off the feature the mark draws,
     * such as `name`, or a `jexl:` expression over `feature`; one that reads
     * nothing names the feature, else its ID, as a feature track's tooltip
     * does. Empty names nothing.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description:
        'the field naming the hovered feature, such as `name`, or a `jexl:` expression over `feature`; empty names nothing',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true },
)

/**
 * #config MultiRowTooltip
 * #category display
 * The multi-row display's `tooltip`: the [](/docs/config/marktooltip) part
 * with a feature track's default `field`, which reads `_mouseOver`, else the
 * name, else `function`, else the ID, so hovering a ClinVar variant names it.
 *
 * #example
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', tooltip: 'sample' }
 * ```
 */
export const multiRowTooltipConfigSchema = ConfigurationSchema(
  'MultiRowTooltip',
  {
    /**
     * #slot
     * Off, hovering a feature opens no box.
     */
    show: showSlot,
    /**
     * #slot
     * The field the box's first line reads off the hovered feature, or a
     * `jexl:` expression over `feature`. Empty names nothing.
     */
    field: featureTooltipFieldSlot,
  },
  { shorthand: 'field', writes: 'members', closed: true },
)
