import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULT_TOOLTIP } from '../RenderFeatureDataRPC/featureTooltip.ts'

/**
 * #config FeatureTooltip
 * #category display
 * The canvas feature displays' `tooltip`, the box hovering a feature opens:
 * whether it `show`s, and the `field` its text reads. A bare string is the
 * field.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   tooltip: "jexl:get(feature,'name') + ' ' + get(feature,'biotype')",
 * }
 * ```
 */
export const featureTooltipConfigSchema = ConfigurationSchema(
  'FeatureTooltip',
  {
    /**
     * #slot
     * Off, hovering still highlights the feature and "Copy tooltip text"
     * still copies it.
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'open the tooltip when the cursor rests on a feature',
    },
    /**
     * #slot
     * Left at the default, the tooltip adds the description line
     * (`labels.description`) as a second row.
     */
    field: {
      type: 'featureField',
      defaultValue: DEFAULT_TOOLTIP,
      description:
        'the field the tooltip reads, such as `product`, or a `jexl:` expression over `feature`; the default reads `_mouseOver`, else the name, else `function`, else the ID',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true },
)
