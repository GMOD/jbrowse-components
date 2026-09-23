import { getSlotDefinition } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

/** Where a display keeps its point size: the value shown, its default, and the write. */
export interface PointSizeAccess {
  value: () => number
  defaultValue: number
  set: (n?: number) => void
}

/**
 * The point size a display holding `WiggleScoreConfigMixin`'s
 * `scatterPointSize` slot shows and writes.
 */
export function scatterPointSizeAccess(self: {
  scatterPointSize: number
  setScatterPointSize: (n?: number) => void
  configuration: ConfigModelForFields<{
    scatterPointSize: { type: 'number'; defaultValue: number }
  }>
}): PointSizeAccess {
  return {
    value: () => self.scatterPointSize,
    defaultValue: Number(
      getSlotDefinition(self.configuration, 'scatterPointSize').defaultValue,
    ),
    set: n => {
      self.setScatterPointSize(n)
    },
  }
}

/**
 * A top-level submenu holding the point-size slider, or nothing where the plot
 * draws no points, so every score plot's menu resets and clamps alike.
 * Top-level rather than under Score because the size describes the mark, not
 * the axis.
 */
export function makePointSizeSubMenu({
  label,
  applies,
  value,
  defaultValue,
  set,
}: PointSizeAccess & { label: string; applies: boolean }): MenuItem[] {
  return applies
    ? [
        {
          label,
          icon: ScatterPlotIcon,
          subMenu: [
            makeSizeMenu({
              label,
              title: 'Point size',
              getValue: value,
              isDefault: value() === defaultValue,
              onChange: set,
              onReset: () => {
                set()
              },
            }),
          ],
        },
      ]
    : []
}
