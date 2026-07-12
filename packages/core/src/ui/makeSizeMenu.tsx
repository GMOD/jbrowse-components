import { useState } from 'react'

import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'
import SingleSlider from './SingleSlider.tsx'

import type { MenuItem } from './MenuTypes.ts'
import type { SessionDefaultControl } from '../configuration/promotableDefaults.ts'

// One inline menu row: the live value/slider with a reset button and, for a
// promotable slot, a pin to make the current value the session-wide default.
// `getValue` is a thunk read inside the observer so the slider tracks the model
// while the menu stays open (a captured number would go stale mid-drag).
//
// `commitOnRelease` is for callers whose onChange is expensive (e.g. the
// alignments modification threshold fires a tier-1 worker refetch): the thumb
// follows a local drag value and only calls onChange when the drag ends. While
// not dragging, dragValue is undefined so the row still reflects the model
// (including external resets).
const SizeSliderRow = observer(function SizeSliderRow({
  title,
  getValue,
  min,
  max,
  step,
  unit,
  isDefault,
  commitOnRelease,
  onChange,
  onReset,
  sessionDefault,
}: {
  title: string
  getValue: () => number
  min: number
  max: number
  step: number
  unit: string
  isDefault: boolean
  commitOnRelease?: boolean
  onChange: (n: number) => void
  onReset: () => void
  sessionDefault?: SessionDefaultControl
}) {
  const modelValue = getValue()
  const [dragValue, setDragValue] = useState<number | undefined>(undefined)
  const value = dragValue ?? modelValue
  const slug = title.toLowerCase().replaceAll(' ', '-')
  return (
    <div style={{ width: 220, padding: '0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Typography variant="caption" color="textSecondary" style={{ flex: 1 }}>
          {title}: {value}
          {unit}
        </Typography>
        <Tooltip title="Reset to default">
          <span>
            <IconButton
              size="small"
              disabled={isDefault}
              onClick={() => {
                onReset()
              }}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {sessionDefault ? (
          <DefaultForAllAdornment label={title} control={sessionDefault} />
        ) : null}
      </div>
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
          if (commitOnRelease) {
            setDragValue(v)
          } else {
            onChange(v)
          }
        }}
        onChangeCommitted={
          commitOnRelease
            ? v => {
                onChange(v)
                setDragValue(undefined)
              }
            : undefined
        }
      />
    </div>
  )
})

// Shared inline "size" control as a single menu row (was a submenu of
// slider/reset/default). Callers own their config slot/semantics and wire the
// accessors + a title (which also derives the slider's test id). Used by wiggle
// point-size/line-width, GWAS Manhattan point-size, and arc width so the
// slider/reset/pin behavior can't drift. Pass `sessionDefault` for a promotable
// slot to surface the "default for all tracks of this type" pin.
export function makeSizeMenu(opts: {
  label: string
  title: string
  getValue: () => number
  isDefault: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  commitOnRelease?: boolean
  onChange: (n: number) => void
  onReset: () => void
  sessionDefault?: SessionDefaultControl
}): MenuItem {
  const {
    label,
    title,
    getValue,
    isDefault,
    min = 0.5,
    max = 12,
    step = 0.5,
    unit = 'px',
    commitOnRelease,
    onChange,
    onReset,
    sessionDefault,
  } = opts
  return {
    label,
    type: 'custom',
    render: () => (
      <SizeSliderRow
        title={title}
        getValue={getValue}
        min={min}
        max={max}
        step={step}
        unit={unit}
        isDefault={isDefault}
        commitOnRelease={commitOnRelease}
        onChange={onChange}
        onReset={onReset}
        sessionDefault={sessionDefault}
      />
    ),
  }
}
