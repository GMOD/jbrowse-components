import { getConf } from '@jbrowse/core/configuration'

import {
  DEFAULT_LINE_WIDTH_PX,
  DEFAULT_POINT_SIZE_PX,
  renderingOf,
} from '../renderingTypes.ts'
import { clampResolution } from './resolution.ts'
import { colorKeyTitleOf } from './scoreRampScale.ts'
import { wiggleColorSettingOf } from './wiggleColor.ts'

import type { LinearWiggleDisplayConfigSchema } from '../LinearWiggleDisplay/configSchema.ts'
import type { WiggleRendering } from '../renderingTypes.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { Extent } from '@jbrowse/wiggle-core'

/** What {@link wiggleConfigViews} reads: the display's config. */
export interface WiggleConfigHost {
  configuration: Instance<LinearWiggleDisplayConfigSchema>
}

/**
 * The wiggle display's own settings as its config writes them. The display
 * installs them as a `.views()` layer; a static export installs the same layer
 * on a model holding the config and the fetched results.
 */
export function wiggleConfigViews(self: WiggleConfigHost) {
  return {
    /**
     * #getter
     * Points per pixel the fetch asks for, clamped to what the Resolution
     * menu offers: the slot is reachable from a track config, which runs no
     * setter, and `0` there divides by zero inside the adapter.
     */
    get resolution(): number {
      return clampResolution(getConf(self, ['data', 'resolution']))
    },
    /**
     * #getter
     * The value bars grow from, which a color scale also reads where its
     * domain is unset.
     */
    get origin(): number {
      return getConf(self, 'origin')
    },
    /**
     * #getter
     * A line's width, `encoding.strokeWidth` or 1 px while unset.
     */
    get lineWidth(): number {
      return (
        getConf(self, ['encoding', 'strokeWidth', 'value']) ??
        DEFAULT_LINE_WIDTH_PX
      )
    },
    /**
     * #getter
     * A point's diameter, `encoding.size` or 2 px while unset.
     */
    get size(): number {
      return (
        getConf(self, ['encoding', 'size', 'value']) ?? DEFAULT_POINT_SIZE_PX
      )
    },
    /**
     * #getter
     */
    get extent(): Extent {
      return getConf(self, ['mark', 'extent'])
    },
    get renderingType(): WiggleRendering {
      return renderingOf(
        getConf(self, ['mark', 'type']),
        getConf(self, ['mark', 'interpolate']),
      )
    },
    /**
     * #getter
     * The `encoding.color` channel as written, `value` undefined while
     * nothing names a color and the layout decides (`effectiveColor`).
     */
    get colorSetting(): ColorSetting {
      return wiggleColorSettingOf(self.configuration.encoding.color)
    },

    /**
     * #getter
     * Whether each source is drawn in a separate row, which is all that
     * `rows.field` decides here: the tree sidebar, the row labels, the separators,
     * the clustering menu and the row-order sort all hang off it.
     */
    get isRowLayout() {
      return getConf(self, ['rows', 'field']) !== ''
    },

    get showRowSeparators(): boolean {
      return getConf(self, ['rows', 'axis', 'grid'])
    },
  }
}

/** What {@link wiggleModeViews} reads: the config leaves and the axis title. */
export interface WiggleModeHost {
  renderingType: WiggleRendering
  colorSetting: ColorSetting
  isRowLayout: boolean
  scaleTitle: string
}

/** What the wiggle display's config leaves make of its mode and keys. */
export function wiggleModeViews(self: WiggleModeHost) {
  return {
    // overrides WiggleScoreConfigMixin's `false` base, which is what its
    // axisReachesZero getter keys on
    get isDensityMode() {
      return self.renderingType === 'density'
    },

    /**
     * #getter
     * The heading both color keys carry: `encoding.color.legend.title` as
     * written (`''` draws none), else the y axis title the key replaces,
     * else `Score`.
     */
    get colorKeyTitle() {
      return colorKeyTitleOf(self.colorSetting.legend.title, self.scaleTitle)
    },

    /**
     * #getter
     * Every source in one plot box. The complement of the row layout, named
     * for what is drawn rather than for the setting that is off.
     */
    get isOverlay() {
      return !self.isRowLayout
    },
  }
}

/** What the export and the screen place the track's label by. */
export function wiggleLabelViews(self: {
  isDensityMode: boolean
  isRowLayout: boolean
}) {
  return {
    /**
     * #getter
     * Offset the track label above the plot so the left y-axis stays pinned
     * to the content edge instead of dodging right of the label, and so a
     * stack of rows is not hidden behind it. One density plot draws no left
     * axis (just a top score legend), so there let the label overlap.
     */
    get prefersOffset() {
      return !self.isDensityMode || self.isRowLayout
    },
  }
}
