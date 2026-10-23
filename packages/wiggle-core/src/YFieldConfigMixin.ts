import { getConf } from '@jbrowse/core/configuration'

import { WiggleScoreConfigMixin } from './WiggleScoreConfigMixin.ts'
import { summaryFieldOf } from './summaryFields.ts'

import type { SummaryField } from './summaryFields.ts'
import type { yEncodingSchema } from './yEncodingConfigSchema.ts'
import type { YFieldChannelConfigSchema } from './yFieldChannelConfigSchema.ts'
import type { YScalePaths } from './yScalePaths.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export interface YFieldConfigHost {
  configuration: ConfigModelForFields<{
    encoding: ReturnType<typeof yEncodingSchema<YFieldChannelConfigSchema>>
  }>
}

const confNode = (self: object) => self as YFieldConfigHost

/**
 * #stateModel YFieldConfigMixin
 * #category display
 *
 * `WiggleScoreConfigMixin` plus `encoding.y.field`, for a display that plots
 * one configured feature field through a `yFieldChannelSchema`: the wiggle
 * display. `LinearMarkDisplay` names a field per mark and composes the base
 * instead.
 */
export function YFieldConfigMixin(paths: YScalePaths) {
  return WiggleScoreConfigMixin(paths).views(self => ({
    /**
     * #getter
     * The feature field the worker plots on the value axis,
     * `encoding.y.field`, `score` by default. A fetch input: every composing
     * display includes it in its `rpcProps()`, since the field is read where
     * the features are.
     */
    get yField(): string {
      return getConf(confNode(self), ['encoding', 'y', 'field'])
    },
    /**
     * #getter
     * The stored summary the plot reads: the field where it names one, else
     * `score`, which a field outside the three holds after the worker reads
     * it.
     */
    get summaryField(): SummaryField {
      return summaryFieldOf(this.yField)
    },
  }))
}
