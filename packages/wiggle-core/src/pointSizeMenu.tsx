import { getSlotDefinition } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * The point-size slider row over `WiggleScoreConfigMixin`'s
 * `scatterPointSize`, so every score plot's menu resets and clamps alike.
 */
export function makeScatterPointSizeMenuItem(
  self: {
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
    configuration: ConfigModelForFields<{
      scatterPointSize: { type: 'number'; defaultValue: number }
    }>
  },
  opts: { label: string },
): MenuItem {
  return makeSizeMenu({
    label: opts.label,
    title: 'Point size',
    getValue: () => self.scatterPointSize,
    isDefault:
      self.scatterPointSize ===
      getSlotDefinition(self.configuration, 'scatterPointSize').defaultValue,
    onChange: n => {
      self.setScatterPointSize(n)
    },
    onReset: () => {
      self.setScatterPointSize(undefined)
    },
  })
}

/**
 * A top-level submenu holding the point-size row, or nothing where the plot
 * draws no points. Top-level rather than under Score because the size
 * describes the mark, not the axis.
 */
export function makePointSizeSubMenu(
  self: Parameters<typeof makeScatterPointSizeMenuItem>[0],
  { label, applies }: { label: string; applies: boolean },
): MenuItem[] {
  return applies
    ? [
        {
          label,
          icon: ScatterPlotIcon,
          subMenu: [makeScatterPointSizeMenuItem(self, { label })],
        },
      ]
    : []
}
