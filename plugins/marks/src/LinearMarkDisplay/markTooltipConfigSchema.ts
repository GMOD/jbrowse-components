import { ConfigurationSchema } from '@jbrowse/core/configuration'

function tooltipSchema(name: string, defaultField: string) {
  return ConfigurationSchema(
    name,
    {
      /**
       * #slot
       * Off, hovering a mark opens no box.
       */
      show: {
        type: 'boolean',
        defaultValue: true,
        description: 'open the tooltip when the cursor rests on a mark',
      },
      /**
       * #slot
       * The field the box's first line reads off the feature the mark draws,
       * such as `name`, or a `jexl:` expression over `feature`; one that
       * reads nothing names the feature, else its ID, as a feature track's
       * tooltip does. Empty names nothing.
       */
      field: {
        type: 'featureField',
        defaultValue: defaultField,
        description:
          'the field naming the hovered feature, such as `name`, or a `jexl:` expression over `feature`; empty names nothing',
      },
    },
    { shorthand: 'field', writes: 'members', closed: true },
  )
}

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
export const markTooltipConfigSchema = tooltipSchema('MarkTooltip', '')

/**
 * #config MultiRowTooltip
 * #category display
 * The multi-row display's `tooltip`: the [](/docs/config/marktooltip) part
 * whose `field` defaults to `name`, else the ID. A field holding a block of
 * markup, such as ClinVar's `_mouseOver`, ships that block with every feature
 * in view, so the default stays the short name and a config opts in.
 *
 * #example
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', tooltip: '_mouseOver' }
 * ```
 */
export const multiRowTooltipConfigSchema = tooltipSchema(
  'MultiRowTooltip',
  'name',
)
