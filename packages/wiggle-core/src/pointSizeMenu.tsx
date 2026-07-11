import { SingleSlider } from '@jbrowse/core/ui'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { MenuItem } from '@jbrowse/core/ui'

// `getValue` is a thunk read inside the observer so the live slider tracks the
// model while the menu stays open (the value is the only thing that changes
// mid-interaction; a captured number would go stale).
const SizeSlider = observer(function SizeSlider({
  title,
  getValue,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  title: string
  getValue: () => number
  min: number
  max: number
  step: number
  unit: string
  onChange: (n: number) => void
}) {
  const value = getValue()
  const slug = title.toLowerCase().replaceAll(' ', '-')
  return (
    <div style={{ width: 200 }}>
      <Typography variant="caption" color="textSecondary">
        {title}: {value}
        {unit}
      </Typography>
      <SingleSlider
        value={value}
        min={min}
        max={max}
        step={step}
        size="small"
        aria-label={title.toLowerCase()}
        data-testid={`${slug}-slider`}
        valueLabelDisplay="auto"
        valueLabelFormat={(v: number) => `${v}${unit}`}
        onChange={v => {
          onChange(v)
        }}
      />
    </div>
  )
})

// Shared inline "size" submenu (live slider + reset row). The wiggle scatter
// point-size, wiggle line-width, and GWAS manhattan point-size controls each
// own their config slot/semantics and just wire the accessors + a title (which
// also derives the slider's test id).
export function makeSizeMenu(opts: {
  label: string
  title: string
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
    label,
    title,
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
        label: `${title} slider`,
        type: 'custom',
        render: () => (
          <SizeSlider
            title={title}
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
        label: 'Reset to default',
        disabled: isDefault,
        onClick: () => {
          onReset()
        },
      },
    ],
  }
}

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
