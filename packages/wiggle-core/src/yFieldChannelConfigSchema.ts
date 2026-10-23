import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULT_SCORE_FIELD } from './summaryFields.ts'
import { yChannelSchema } from './yChannelConfigSchema.ts'

import type { YScaleOptions } from './yScaleConfigSchema.ts'

/**
 * #config YFieldChannel
 * #category display
 * A [YChannel](../ychannel) that also names the field it plots, the wiggle
 * display's `encoding.y`. A bare string is the `field`.
 *
 * #example
 * The bins' maxima on a log axis:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   encoding: { y: { field: 'maxScore', scale: { type: 'log' } } },
 * }
 * ```
 *
 * #example
 * The whole visible range, spikes included, rather than the fence the wiggle
 * display starts on:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   encoding: { y: { scale: { fenceQuantile: 1 } } },
 * }
 * ```
 */
export function yFieldChannelSchema(options: YScaleOptions = {}) {
  return ConfigurationSchema(
    'YFieldChannel',
    {
      /**
       * #slot
       */
      field: {
        type: 'featureField',
        defaultValue: DEFAULT_SCORE_FIELD,
        description:
          "the feature field plotted on the value axis, as a mark's encoding.y names one. `score`, `minScore` and `maxScore` are a zoom bin's stored mean, minimum and maximum, which every quantitative source serves, a raw record answering its score for all three. Any other name, a dotted path or a `jexl:` expression reads a raw column the adapter left alone (a BED extra column, a GFF attribute) and draws no min-max extent. A feature with no finite value in the field plots at 0",
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: yChannelSchema(options),
      shorthand: 'field',
      writes: 'members',
    },
  )
}

export type YFieldChannelConfigSchema = ReturnType<typeof yFieldChannelSchema>
