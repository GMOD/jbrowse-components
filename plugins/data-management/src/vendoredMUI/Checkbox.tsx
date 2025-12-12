import React, { memo } from 'react'

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
    cursor: 'pointer',
  },
  disabled: {
    cursor: 'default',
  },
  checked: {
    color: theme.palette.primary.main,
  },
  unchecked: {
    color: theme.palette.text.secondary,
  },
  disabledIcon: {
    color: theme.palette.action.disabled,
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
}))

// Inline SVG
const svgStyle: React.CSSProperties = {
  width: '1em',
  height: '1em',
  fontSize: '1.375rem', // 22px
  display: 'inline-block',
  flexShrink: 0,
  userSelect: 'none',
  fill: 'currentColor',
}

const CheckedIcon = memo(function CheckedIcon({
  className,
}: {
  className: string
}) {
  return (
    <svg className={className} style={svgStyle} viewBox="0 0 24 24">
      <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  )
})

const UncheckedIcon = memo(function UncheckedIcon({
  className,
}: {
  className: string
}) {
  return (
    <svg className={className} style={svgStyle} viewBox="0 0 24 24">
      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  )
})

interface CheckboxProps {
  checked?: boolean
  className?: string
  disabled?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  slotProps?: {
    input?: Record<string, unknown>
  }
}

function Checkbox({
  checked,
  className,
  disabled,
  onChange,
  slotProps,
}: CheckboxProps) {
  const { classes, cx } = useStyles()

  const iconClass = disabled
    ? classes.disabledIcon
    : checked
      ? classes.checked
      : classes.unchecked

  return (
    <span className={cx(classes.root, disabled && classes.disabled, className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={classes.input}
        {...slotProps?.input}
      />
      {checked ? (
        <CheckedIcon className={iconClass} />
      ) : (
        <UncheckedIcon className={iconClass} />
      )}
    </span>
  )
}

export default memo(Checkbox)
