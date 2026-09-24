import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorChannelOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { ARC_COLOR_FIELD_SLOTS } from './arcColorConfigSchema.ts'

/**
 * #config PairedArcColor
 * #category display
 * The paired arc display's `color`: the same object as [ArcColor](../arccolor),
 * whose `value` callback also reads `alt`, the breakend's ALT the arc was
 * drawn for; a `field` reads the record.
 *
 * #example
 * ```js
 * { type: 'LinearPairedArcDisplay', color: { field: 'INFO.SVTYPE' } }
 * ```
 */
export const pairedArcColorSchema = ConfigurationSchema(
  'PairedArcColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` and `alt` returning
     * one; the default colours each SV type read off the ALT.
     */
    value: {
      type: 'color',
      defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
      description: 'CSS colour or jexl callback over feature and alt',
      contextVariable: ['feature', 'alt'],
    },
    ...ARC_COLOR_FIELD_SLOTS,
  },
  colorChannelOptions('color'),
)
