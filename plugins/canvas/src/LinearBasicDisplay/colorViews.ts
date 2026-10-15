import { getConf } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'

import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface ColorHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  conf: Instance<LinearCanvasBaseDisplayConfigModel>
  colorField: string | undefined
  colorSetting: ColorSetting
  solidColor: string | undefined
}

export function colorViews(self: ColorHost) {
  return {
    /**
     * #getter
     */
    get showOutline(): boolean {
      return getConf(self, 'showOutline')
    },

    /**
     * #getter
     * The outline's color as written, undefined taking the theme's.
     */
    get outlineColor(): string | undefined {
      return getConf(self, 'outlineColor')
    },

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
      const { field } = self.colorSetting
      return field === STRAND_FIELD ? '' : field
    },
  }
}
