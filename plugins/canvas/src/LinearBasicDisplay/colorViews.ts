import { getConf } from '@jbrowse/core/configuration'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  categoricalColorField,
  colorEncodingOf,
  colorMembersOf,
  colorScaleChoicesOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import {
  FEATURE_DEFAULT_COLOR,
  UTR_DEFAULT_COLOR,
} from '../RenderFeatureDataRPC/featureColors.ts'

import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
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
      const raw = self.conf.color.value
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
      const encoding = this.colorEncoding
      if (typeof encoding === 'object') {
        return encoding.field === STRAND_FIELD ? 'strand' : 'attribute'
      }
      if (encoding === undefined) {
        return 'default'
      }
      return isJexl(encoding) ? 'attribute' : 'solid'
    },

    /**
     * #getter
     */
    get colorByAttribute(): string {
      const { field } = this.colorSettings
      return field === STRAND_FIELD ? '' : field
    },

    /**
     * #getter
     * `colorSettings` as it paints, through the one resolver every display's
     * colour object goes through: `color.value`, or a field's categorical
     * scale.
     */
    get colorEncoding() {
      return colorEncodingOf(this.colorSettings, 'categorical')
    },

    /**
     * #getter
     * The color channel's field, or undefined while `color.value` paints.
     */
    get colorField() {
      return categoricalColorField(this.colorEncoding)
    },

    /**
     * #getter
     * The scales this display's colour paints, for the Edit as JSON box.
     */
    get colorScaleChoices(): string[] {
      return colorScaleChoicesOf(self.conf.color)
    },

    /**
     * #getter
     * The members this display's colour object declares, for the Edit as
     * JSON box.
     */
    get colorMembers(): string[] {
      return colorMembersOf(self.conf.color)
    },

    /**
     * #getter
     * The `color` object as written, its `value` and `field` raw: either
     * may be a `jexl:` expression over a feature, which has none here.
     */
    get colorSettings(): ColorSetting {
      return {
        value: self.conf.color.value,
        field: self.conf.color.field,
        scale: getConf(self, ['color', 'scale']),
        domain: getConf(self, ['color', 'domain']),
        range: getConf(self, ['color', 'range']),
      }
    },
  }
}
