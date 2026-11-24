import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  linearWiggleDisplayConfigSchema,
  wiggleMarkWithoutExtent,
} from '@jbrowse/plugin-wiggle'

export const gcWiggleConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    mark: wiggleMarkWithoutExtent(
      "a GC window has one score and no min or max to draw, so 'none'",
    ),
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 10_000_000,
      description:
        'bases a region may scan before the display asks first, since GC content is computed from one byte per base of sequence; 10 Mb draws a bacterial genome whole and asks first over a human chromosome',
      advanced: true,
    },
  },
  { baseConfiguration: linearWiggleDisplayConfigSchema },
)
