import { SingleSlider } from '@jbrowse/core/ui'
import LineWeightIcon from '@mui/icons-material/LineWeight'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { defaultArcLineWidth } from './configSchema.ts'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Emulates the wiggle/GWAS "scatter plot point size" menu
// (packages/wiggle-core/src/pointSizeMenu.tsx). `getValue` is a thunk read
// inside the observer so the live slider tracks the model while the menu stays
// open. Arc stroke width is a pure repaint (main-thread SVG, no RPC worker), so
// it commits live on `onChange` rather than on release.
const ArcWidthSlider = observer(function ArcWidthSlider({
  getValue,
  onChange,
}: {
  getValue: () => number
  onChange: (n: number) => void
}) {
  const value = getValue()
  return (
    <div style={{ width: 200 }}>
      <Typography variant="caption" color="textSecondary">
        Arc width: {value}px
      </Typography>
      <SingleSlider
        value={value}
        min={1}
        max={20}
        step={1}
        size="small"
        aria-label="arc width"
        data-testid="arc-width-slider"
        valueLabelDisplay="auto"
        valueLabelFormat={(v: number) => `${v}px`}
        onChange={n => {
          onChange(n)
        }}
      />
    </div>
  )
})

export function makeLineWidthMenuItem(
  self: LinearPairedArcDisplayModel,
): MenuItem {
  return {
    label: 'Arc width',
    icon: LineWeightIcon,
    subMenu: [
      {
        label: 'Arc width slider',
        type: 'custom',
        render: () => (
          <ArcWidthSlider
            getValue={() => self.lineWidth}
            onChange={n => {
              self.setLineWidth(n)
            }}
          />
        ),
      },
      {
        label: 'Reset to default width',
        disabled: self.lineWidth === defaultArcLineWidth,
        onClick: () => {
          self.setLineWidth(undefined)
        },
      },
    ],
  }
}
