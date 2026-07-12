import { useState } from 'react'

import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'
import {
  INLINE_MENU_ROW_WIDTH,
  ResetToDefaultButton,
} from './InlineMenuControls.tsx'
import SingleSlider from './SingleSlider.tsx'
import { sliderScale } from './sliderScale.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { SliderScale } from './sliderScale.ts'
import type { SessionDefaultControl } from '../configuration/promotableDefaults.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    width: INLINE_MENU_ROW_WIDTH,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  label: {
    flex: 1,
  },
}))

// One inline menu row: the live value/slider with a reset button and, for a
// promotable slot, a pin to make the current value the session-wide default.
// `getValue` is a thunk read inside the observer so the slider tracks the model
// while the menu stays open (a captured number would go stale mid-drag).
//
// `commitOnRelease` is for callers whose onChange is expensive (e.g. the
// alignments modification threshold fires a tier-1 worker refetch, GC-content
// window size triggers a reload): the thumb follows a local drag value and only
// calls onChange when the drag ends. While not dragging, dragValue is undefined
// so the row still reflects the model (including external resets).
const SizeSliderRow = observer(function SizeSliderRow({
  title,
  getValue,
  min,
  max,
  step,
  scale,
  format,
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
  scale: SliderScale
  format: (n: number) => string
  isDefault: boolean
  commitOnRelease?: boolean
  onChange: (n: number) => void
  onReset: () => void
  sessionDefault?: SessionDefaultControl
}) {
  const { classes } = useStyles()
  const modelValue = getValue()
  const [dragValue, setDragValue] = useState<number | undefined>(undefined)
  const value = dragValue ?? modelValue
  const { toSlider, fromSlider, sliderStep } = sliderScale(scale)
  const slug = title.toLowerCase().replaceAll(' ', '-')
  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.label}
        >
          {title}: {format(value)}
        </Typography>
        <ResetToDefaultButton
          disabled={isDefault}
          onClick={() => {
            onReset()
          }}
        />
        {sessionDefault ? (
          // include the current value so the manage-default dialog/tooltip read
          // as a concrete value ("Line width (2px)") — the copy assumes the
          // label is a value, but a bare setting name reads oddly ("Use 'Line
          // width' as the default")
          <DefaultForAllAdornment
            label={`${title} (${format(value)})`}
            control={sessionDefault}
          />
        ) : null}
      </div>
      <SingleSlider
        value={toSlider(value)}
        min={toSlider(min)}
        max={toSlider(max)}
        step={sliderStep ?? step}
        size="small"
        aria-label={title.toLowerCase()}
        data-testid={`${slug}-slider`}
        valueLabelDisplay="auto"
        valueLabelFormat={(v: number) => format(fromSlider(v))}
        sx={{ py: 0.5, display: 'block' }}
        onChange={v => {
          const n = fromSlider(v)
          if (commitOnRelease) {
            setDragValue(n)
          } else {
            onChange(n)
          }
        }}
        onChangeCommitted={
          commitOnRelease
            ? v => {
                onChange(fromSlider(v))
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
// point-size/line-width, GWAS Manhattan point-size, arc width, the alignments
// modification threshold and GC-content window/step sizes, so the
// slider/reset/pin behavior can't drift. Pass `sessionDefault` for a promotable
// slot to surface the "default for all tracks of this type" pin, `scale: 'log'`
// for values spanning orders of magnitude, and `format` to label non-`px`
// units.
export function makeSizeMenu(opts: {
  label: string
  title: string
  getValue: () => number
  isDefault: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  scale?: SliderScale
  format?: (n: number) => string
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
    scale = 'linear',
    format = (n: number) => `${n}${unit}`,
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
        scale={scale}
        format={format}
        isDefault={isDefault}
        commitOnRelease={commitOnRelease}
        onChange={onChange}
        onReset={onReset}
        sessionDefault={sessionDefault}
      />
    ),
  }
}
