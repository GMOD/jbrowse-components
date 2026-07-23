import { useRef, useState } from 'react'

import useMeasure from '@jbrowse/core/util/useMeasure'
import { InputBase, Typography, useTheme } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

import type { TypographyProps } from '@mui/material'
import type { Ref } from 'react'

type Variant = TypographyProps['variant']

type EditableTypographyClassKey =
  | 'input'
  | 'inputBase'
  | 'inputRoot'
  | 'inputFocused'

const useStyles = makeStyles()(theme => ({
  typography: {
    top: 6,
    left: 2,
    position: 'absolute',
    whiteSpace: 'nowrap',
    visibility: 'hidden',
  },
  inputRoot: {
    padding: theme.spacing(0.5),
  },
  inputFocused: {
    borderStyle: 'solid',
    borderWidth: 2,
  },
}))

interface Props {
  value: string
  setValue: (value: string) => void
  variant: Variant
  classes?: Partial<Record<EditableTypographyClassKey, string>>
  ref?: Ref<HTMLDivElement>
}

function EditableTypography(props: Props) {
  const { value, setValue, variant, ref, classes: overrides, ...other } = props
  const [ref2, { width }] = useMeasure()
  const [editedValue, setEditedValue] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  // set by Escape so the synchronous blur() it triggers discards the edit;
  // onBlur's editedValue closure is still the typed value at that point
  const cancelRef = useRef(false)

  const { classes, cx } = useStyles()
  const theme = useTheme()

  const val = editedValue ?? value

  return (
    <div {...other} ref={ref}>
      <div style={{ position: 'relative' }}>
        <Typography
          ref={ref2}
          component="span"
          variant={variant}
          className={classes.typography}
        >
          {val}
        </Typography>
      </div>
      <InputBase
        inputRef={inputRef}
        className={overrides?.inputBase}
        slotProps={{
          input: {
            style: {
              width,
              ...(variant && variant !== 'inherit'
                ? theme.typography[variant]
                : {}),
            },
          },
        }}
        classes={{
          input: overrides?.input,
          root: cx(classes.inputRoot, overrides?.inputRoot),
          focused: cx(classes.inputFocused, overrides?.inputFocused),
        }}
        value={val}
        onChange={event => {
          setEditedValue(event.target.value)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            inputRef.current?.blur()
          } else if (event.key === 'Escape') {
            cancelRef.current = true
            inputRef.current?.blur()
          }
        }}
        onBlur={() => {
          if (cancelRef.current) {
            cancelRef.current = false
          } else if (editedValue !== undefined) {
            setValue(editedValue)
          }
          setEditedValue(undefined)
        }}
      />
    </div>
  )
}

export default EditableTypography
