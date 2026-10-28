import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'

import type { LinearFeatureBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface ColorHost {
  configuration: Instance<LinearFeatureBaseDisplayConfigModel>
  conf: Instance<LinearFeatureBaseDisplayConfigModel>
  colorField: string | undefined
  colorSetting: ColorSetting
  parkedColor?: ColorSlots
  solidColor: string | undefined
}

export function colorViews(self: ColorHost) {
  return {
    /**
     * #getter
     */
    // Raw slot rather than getConf: a jexl color evaluated without a feature
    // throws, and a jexl string is no CSS color anyway.
    get featureColor() {
      return self.solidColor ?? featureDefaultColor
    },

    /**
     * #getter
     */
    get colorByAttribute(): string {
      const field = self.colorSetting.field || self.parkedColor?.field || ''
      return field === STRAND_FIELD ? '' : field
    },
  }
}
