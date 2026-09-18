import { getConf } from '@jbrowse/core/configuration'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import {
  FEATURE_DEFAULT_COLOR,
  UTR_DEFAULT_COLOR,
  featureColorScale,
} from '../RenderFeatureDataRPC/featureColors.ts'

import type { ColorScaleSettings } from '../RenderFeatureDataRPC/featureColors.ts'
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
      const { color, colorField } = self.conf
      return colorField === STRAND_FIELD
        ? 'strand'
        : colorField || (color !== undefined && isJexl(color))
          ? 'attribute'
          : color === undefined
            ? 'default'
            : 'solid'
    },

    /**
     * #getter
     */
    get colorByAttribute(): string {
      const { colorField } = self.conf
      return colorField === STRAND_FIELD ? '' : colorField
    },

    /**
     * #getter
     * The color channel's field, or undefined while the `color` slot
     * paints.
     */
    get colorEncoding() {
      return featureColorScale(this.colorSettings)
    },

    /**
     * #getter
     * The color slots as written, the scale's three unresolved.
     */
    get colorSettings(): ColorScaleSettings & { color: string | undefined } {
      return {
        color: self.conf.color,
        colorField: getConf(self, 'colorField'),
        colorDomain: getConf(self, 'colorDomain'),
        colorPalette: getConf(self, 'colorPalette'),
      }
    },
  }
}
