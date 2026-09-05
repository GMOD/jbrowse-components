import { getConf } from '@jbrowse/core/configuration'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import {
  FEATURE_DEFAULT_COLOR,
  STRAND_COLOR_JEXL,
  UTR_DEFAULT_COLOR,
} from '../RenderFeatureDataRPC/featureColors.ts'

import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/** The typed config the color swatches and the "Color by..." radio read. */
export interface ColorHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  conf: Instance<LinearCanvasBaseDisplayConfigModel>
}

/**
 * The color picker swatches and the "Color by..." mode, as one `.views()`
 * layer (ADR-041).
 */
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
    // Solid color for the picker swatch. Reads the raw config `color`
    // slot value directly (self.conf.color, not getConf) so an unset or
    // jexl-expression color doesn't get evaluated without a feature —
    // jexl strings aren't valid CSS colors anyway, so they fall back to
    // the default swatch same as unset.
    get featureColor() {
      const raw = self.conf.color
      return raw !== undefined && !isJexl(raw) ? raw : FEATURE_DEFAULT_COLOR
    },

    /**
     * #getter
     */
    // Swatch for the UTR color picker. The slot is a `maybeColor`, so
    // resolve its unset state here — a bare getter must never hand back
    // undefined. Unset means the render falls back to a feature's own BED
    // color when it has one, which no single swatch can show, so the swatch
    // shows what an itemRgb-less feature actually gets.
    //
    // Reads the raw slot value, not getConf — the same jexl-without-a-feature
    // hazard as `featureColor` above, and for the same reason: `utrColor` is a
    // per-feature callback slot, so getConf evaluates the expression against
    // no feature and throws out of the dialog this feeds. A jexl string is not
    // a CSS color anyway, so it shows the default swatch like unset does.
    get utrColor(): string {
      const raw = self.conf.utrColor
      return raw !== undefined && !isJexl(raw) ? raw : UTR_DEFAULT_COLOR
    },

    /**
     * #getter
     */
    // Which "Color by..." choice is active, so the track menu can show a
    // radio checkmark. An unset slot is 'default' (a feature's own itemRgb,
    // else the stock fill), which no solid swatch can stand in for; 'strand'
    // is the exact built-in jexl; any other jexl value is a per-attribute
    // expression; anything else is a solid color. Reads the raw slot value
    // (not getConf) — same jexl-without-a-feature hazard as featureColor.
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
    // The attribute name baked into an active "Color by attribute" jexl, so
    // the dialog reopens prefilled instead of blank. Empty unless that mode
    // is active.
    get colorByAttribute() {
      const raw = self.conf.color
      // Empty unless "Color by attribute" is active. raw is a jexl string
      // in that mode; narrow it explicitly so the regex gets a defined
      // string rather than masking undefined with a fallback.
      if (this.colorByMode !== 'attribute' || raw === undefined) {
        return ''
      }
      return /get\(feature,'([^']+)'\)/.exec(raw)?.[1] ?? ''
    },
  }
}
