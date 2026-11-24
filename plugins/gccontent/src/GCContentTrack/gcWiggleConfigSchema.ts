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
    // a byte per base scanned: a bacterial genome draws whole, a human
    // chromosome asks first
    fetchSizeLimit: { type: 'number', defaultValue: 10_000_000 },
  },
  { baseConfiguration: linearWiggleDisplayConfigSchema },
)
