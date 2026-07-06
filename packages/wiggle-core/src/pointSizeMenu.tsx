import { SingleSlider } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { MenuItem } from '@jbrowse/core/ui'

// `getValue` is a thunk read inside the observer so the live slider tracks the
// model while the menu stays open (the value is the only thing that changes
// mid-interaction; a captured number would go stale).
const PointSizeSlider = observer(function PointSizeSlider({
  getValue,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  getValue: () => number
  min: number
  max: number
  step: number
  unit: string
  onChange: (n: number) => void
}) {
  const value = getValue()
  return (
    <div style={{ width: 200 }}>
      <Typography variant="caption" color="textSecondary">
        Point size: {value}
        {unit}
      </Typography>
      <SingleSlider
        value={value}
        min={min}
        max={max}
        step={step}
        size="small"
        aria-label="point size"
        data-testid="point-size-slider"
        valueLabelDisplay="auto"
        valueLabelFormat={(v: number) => `${v}${unit}`}
        onChange={v => {
          onChange(v)
        }}
      />
    </div>
  )
})

// Shared "point size" submenu (inline slider + reset row) used by the wiggle
// scatter and GWAS manhattan displays. Each display owns its own config
// slot/semantics and just wires the accessors.
export function makePointSizeMenu(opts: {
  label?: string
  icon?: React.ElementType
  getValue: () => number
  isDefault: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (n: number) => void
  onReset: () => void
}): MenuItem {
  const {
    label = 'Point size',
    icon,
    getValue,
    isDefault,
    min = 0.5,
    max = 12,
    step = 0.5,
    unit = 'px',
    onChange,
    onReset,
  } = opts
  return {
    label,
    icon,
    subMenu: [
      {
        label: 'Point size slider',
        type: 'custom',
        render: () => (
          <PointSizeSlider
            getValue={getValue}
            min={min}
            max={max}
            step={step}
            unit={unit}
            onChange={onChange}
          />
        ),
      },
      {
        label: 'Reset to default size',
        disabled: isDefault,
        onClick: () => {
          onReset()
        },
      },
    ],
  }
}

// Wires a display's shared `scatterPointSize`/`setScatterPointSize` (from
// WiggleScoreConfigMixin) to makePointSizeMenu. Used by both the wiggle scatter
// and GWAS Manhattan track menus so the slider/reset behavior can't drift.
export function makeScatterPointSizeMenuItem(
  self: {
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  },
  opts: { label: string; defaultValue: number },
): MenuItem {
  return makePointSizeMenu({
    label: opts.label,
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
