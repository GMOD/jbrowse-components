import type { wiggleDataConfigSchema } from './wiggleDataConfigSchema.ts'
import type { wiggleEncodingConfigSchema } from './wiggleEncodingConfigSchema.ts'
import type { wiggleMarkConfigSchema } from './wiggleMarkConfigSchema.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export const wiggleConfigSchemaFields = {
  origin: {
    type: 'number',
    defaultValue: 0,
    description:
      "The value bars grow from, and the cut a threshold color scale with an empty domain uses. The same slot, with the same meaning, as the mark display's origin",
    plot: true,
  },
} as const

/** A wiggle display's configuration, whose slot names `getConf` checks. */
export type WiggleConfigModel = ConfigModelForFields<
  typeof wiggleConfigSchemaFields & {
    mark: typeof wiggleMarkConfigSchema
    encoding: typeof wiggleEncodingConfigSchema
    data: typeof wiggleDataConfigSchema
  }
>
