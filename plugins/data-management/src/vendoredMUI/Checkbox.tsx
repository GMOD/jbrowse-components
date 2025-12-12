import React, { forwardRef } from 'react'

import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
    outline: 0,
    border: 0,
    margin: 0,
    padding: 9,
    userSelect: 'none',
    verticalAlign: 'middle',
    borderRadius: '50%',
  },
  input: {
    cursor: 'inherit',
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    margin: 0,
    padding: 0,
    zIndex: 1,
  },
  checked: {
    color: theme.palette.primary.main,
  },
  unchecked: {
    color: theme.palette.text.secondary,
  },
  disabled: {
    color: theme.palette.action.disabled,
    cursor: 'default',
  },
}))

interface CheckboxProps {
  checked?: boolean
  className?: string
  disabled?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  slotProps?: {
    input?: Record<string, unknown>
  }
}

const Checkbox = forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  { checked, className, disabled, onChange, slotProps },
  ref,
) {
  const { classes, cx } = useStyles()

  return (
    <span
      ref={ref}
      className={cx(classes.root, className)}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={classes.input}
        {...slotProps?.input}
      />
      {checked ? (
        <CheckBoxIcon className={disabled ? classes.disabled : classes.checked} />
      ) : (
        <CheckBoxOutlineBlankIcon
          className={disabled ? classes.disabled : classes.unchecked}
        />
      )}
    </span>
  )
})

export default Checkbox
