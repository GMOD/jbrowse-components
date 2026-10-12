import { makeSizeMenu } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import type { MenuItem } from '@jbrowse/core/ui'
import type { ElementType } from 'react'

/**
 * A top-level submenu holding a mark's size slider, or nothing where the plot
 * draws no such mark, so every score plot's menu resets and clamps alike.
 * Top-level rather than under Score because the size describes the mark, not
 * the axis.
 */
export function makeMarkSizeSubMenu({
  label,
  title = 'Point size',
  icon = ScatterPlotIcon,
  applies,
  value,
  isDefault,
  set,
  min,
  max,
  step,
}: {
  label: string
  title?: string
  icon?: ElementType
  applies: boolean
  value: () => number
  isDefault: boolean
  set: (n?: number) => void
  min?: number
  max?: number
  step?: number
}): MenuItem[] {
  return applies
    ? [
        {
          label,
          icon,
          subMenu: [
            makeSizeMenu({
              label,
              title,
              min,
              max,
              step,
              getValue: value,
              isDefault,
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
