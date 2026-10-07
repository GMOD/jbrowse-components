import { makeSizeMenu } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import type { MenuItem } from '@jbrowse/core/ui'

/** Where a display keeps its point size: the value shown, its default, and the write. */
export interface PointSizeAccess {
  value: () => number
  defaultValue: number
  set: (n?: number) => void
}

/**
 * The point size a display holding a `size` slot shows and writes, against
 * the diameter it draws while the slot is unset.
 */
export function pointSizeAccess(
  self: { size: number; setSize: (n?: number) => void },
  defaultValue: number,
): PointSizeAccess {
  return {
    value: () => self.size,
    defaultValue,
    set: n => {
      self.setSize(n)
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
