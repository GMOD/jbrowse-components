import { makeSizeMenu } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import type { MenuItem } from '@jbrowse/core/ui'

export { makeSizeMenu }

// Wires a display's shared `scatterPointSize`/`setScatterPointSize` (from
// WiggleScoreConfigMixin) to makeSizeMenu. Used by both the wiggle scatter and
// GWAS Manhattan track menus so the slider/reset behavior can't drift.
export function makeScatterPointSizeMenuItem(
  self: {
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  },
  opts: { label: string; defaultValue: number },
): MenuItem {
  return makeSizeMenu({
    label: opts.label,
    title: 'Point size',
    icon: ScatterPlotIcon,
    getValue: () => self.scatterPointSize,
    isDefault: self.scatterPointSize === opts.defaultValue,
    onChange: n => {
      self.setScatterPointSize(n)
    },
    onReset: () => {
      self.setScatterPointSize(undefined)
    },
  })
}
