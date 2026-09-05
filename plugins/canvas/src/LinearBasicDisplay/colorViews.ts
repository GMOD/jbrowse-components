import { getConf } from '@jbrowse/core/configuration'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import {
  FEATURE_DEFAULT_COLOR,
  STRAND_COLOR_JEXL,
  UTR_DEFAULT_COLOR,
} from '../RenderFeatureDataRPC/featureColors.ts'

import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface ColorHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  conf: Instance<LinearCanvasBaseDisplayConfigModel>
}

export function colorViews(self: ColorHost) {
  return {
    /**
     * #getter
     */
    get showOutline() {
      return !!getConf(self, 'outlineColor')
    },

    /**
     * #getter
     */
    // Raw slot rather than getConf: a jexl color evaluated without a feature
    // throws, and a jexl string is no CSS color anyway.
    get featureColor() {
      const raw = self.conf.color
      return raw !== undefined && !isJexl(raw) ? raw : FEATURE_DEFAULT_COLOR
    },

    /**
     * #getter
     */
    // A `maybeColor` slot, resolved here so the getter never hands back
    // undefined; raw read for the same reason as `featureColor`.
    get utrColor(): string {
      const raw = self.conf.utrColor
      return raw !== undefined && !isJexl(raw) ? raw : UTR_DEFAULT_COLOR
    },

    /**
     * #getter
     */
    get colorByMode(): 'default' | 'strand' | 'attribute' | 'solid' {
      const raw = self.conf.color
      return raw === undefined
        ? 'default'
        : raw === STRAND_COLOR_JEXL
          ? 'strand'
          : isJexl(raw)
            ? 'attribute'
            : 'solid'
    },

    /**
     * #getter
     */
    get colorByAttribute() {
      const raw = self.conf.color
      if (this.colorByMode !== 'attribute' || raw === undefined) {
        return ''
      }
      return /get\(feature,'([^']+)'\)/.exec(raw)?.[1] ?? ''
    },
  }
}
