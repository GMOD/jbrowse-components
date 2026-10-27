import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { wiggleMarkConfigSchema } from './wiggleMarkConfigSchema.ts'

/** The `mark` of a track type whose wiggle display draws no band by default. */
export function wiggleMarkWithoutExtent(description?: string) {
  return ConfigurationSchema(
    'WiggleMark',
    {
      extent: {
        type: 'stringEnum',
        defaultValue: 'none',
        ...(description ? { description } : {}),
      },
    },
    { baseConfiguration: wiggleMarkConfigSchema },
  )
}
