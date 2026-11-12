import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
export const multiRowTooltipConfigSchema = ConfigurationSchema(
  'MultiRowTooltip',
  {
    /**
     * #slot
     * Off, hovering a feature opens no box.
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'open the tooltip when the cursor rests on a feature',
    },
    /**
     * #slot
     * The field the box's first line reads off the hovered feature, or a
     * `jexl:` expression over `feature`; one that reads nothing names the
     * feature by its ID. Empty names nothing.
     */
    field: {
      type: 'featureField',
      defaultValue: 'name',
      description:
        'the field naming the hovered feature, or a `jexl:` expression over `feature`; empty names nothing',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true },
)
