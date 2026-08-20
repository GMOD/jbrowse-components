// The drawn half of a `makeSizeMenu` row, split out so the builder can reach
// it through `lazy()`. Everything Material UI in a size row is here: the
// slider, the reset button, the pin, the caption. See makeSizeMenu.tsx.
import { useState } from 'react'

import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import CascadingMenuHelpIconButton from './CascadingMenuHelpIconButton.tsx'
import { ResetToDefaultButton } from './InlineMenuControls.tsx'
import { PinAdornment } from './PinAdornment.tsx'
import SingleSlider from './SingleSlider.tsx'
import { INLINE_MENU_ROW_WIDTH } from './inlineMenuRowWidth.ts'
import { sliderScale } from './sliderScale.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'
import type { SliderScale } from './sliderScale.ts'

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

export const SizeSliderRow = observer(function SizeSliderRow({
  title,
  help,
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
  pin,
}: {
  title: string
  help?: string
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
  pin?: Pin
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
        {help ? (
          <CascadingMenuHelpIconButton helpText={help} label={title} />
        ) : null}
        <ResetToDefaultButton
          disabled={isDefault}
          onClick={() => {
            onReset()
          }}
        />
        {pin ? (
          // include the current value so the pin's tooltip reads as a concrete
          // value ("Line width (2px)") — the copy assumes the label is a value,
          // but a bare setting name reads oddly ("Use 'Line width' as the
          // default")
          <PinAdornment
            pin={{ control: pin, label: `${title} (${format(value)})` }}
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
