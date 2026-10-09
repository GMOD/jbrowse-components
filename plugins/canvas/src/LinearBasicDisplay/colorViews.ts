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
      return this.solidColor ?? featureDefaultColor
    },

    /**
     * #getter
     * The constant `color.value` holds, painting or kept beside a field;
     * undefined where it holds none or a `jexl:` expression.
     */
    get solidColor(): string | undefined {
      const raw = self.conf.color.value
      return raw !== undefined && !isJexl(raw) ? raw : undefined
    },

    /**
     * #getter
     * The Color by radio that is ticked: a field, else a constant, else the
     * track's own color.
     */
    get colorByMode(): 'default' | 'solid' | 'strand' | 'attribute' {
      const field = self.colorFieldName
      return field === undefined
        ? this.solidColor === undefined
          ? 'default'
          : 'solid'
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
