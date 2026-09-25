import { getConf } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface ColorHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  conf: Instance<LinearCanvasBaseDisplayConfigModel>
  colorFieldName: string | undefined
  colorSettings: ColorSetting
}

export function colorViews(self: ColorHost) {
  return {
    /**
     * #getter
     */
    get showOutline() {
      return !!this.outlineColorSlot
    },

    /**
     * #getter
     * The `outlineColor` slot as written: `''`, `THEME_DERIVED_COLOR`, or a
     * literal, which `resolveOutlineColor` packs against a palette.
     */
    get outlineColorSlot(): string {
      return getConf(self, 'outlineColor')
    },

    /**
     * #getter
     */
    // Raw slot rather than getConf: a jexl color evaluated without a feature
    // throws, and a jexl string is no CSS color anyway.
    get featureColor() {
      const raw = self.conf.color.value
      return raw !== undefined && !isJexl(raw) ? raw : featureDefaultColor
    },

    /**
     * #getter
     */
    get colorByMode(): 'default' | 'strand' | 'attribute' {
      const field = self.colorFieldName
      return field === undefined
        ? 'default'
        : field === STRAND_FIELD
          ? 'strand'
          : 'attribute'
    },

    /**
     * #getter
     */
    get colorByAttribute(): string {
      const { field } = self.colorSettings
      return field === STRAND_FIELD ? '' : field
    },
  }
}
