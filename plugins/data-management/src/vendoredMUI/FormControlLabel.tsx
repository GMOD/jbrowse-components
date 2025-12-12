import React, { cloneElement, isValidElement, memo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    verticalAlign: 'middle',
    WebkitTapHighlightColor: 'transparent',
    marginLeft: -11,
    marginRight: 16,
  },
  disabled: {
    cursor: 'default',
  },
  label: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
  },
  labelDisabled: {
    color: theme.palette.text.disabled,
  },
}))

interface FormControlLabelProps {
  control: React.ReactElement
  label?: React.ReactNode
  className?: string
  disabled?: boolean
  onChange?: (event: React.SyntheticEvent) => void
  onClick?: (event: React.MouseEvent<HTMLLabelElement>) => void
  onMouseEnter?: (event: React.MouseEvent<HTMLLabelElement>) => void
  onMouseLeave?: (event: React.MouseEvent<HTMLLabelElement>) => void
}

function FormControlLabel({
  control,
  label,
  className,
  disabled: disabledProp,
  onChange,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: FormControlLabelProps) {
  const { classes, cx } = useStyles()
  const disabled =
    disabledProp ??
    (isValidElement(control)
      ? (control.props as { disabled?: boolean }).disabled
      : false)

  const controlProps: Record<string, unknown> = { disabled }
  if (onChange !== undefined) {
    controlProps.onChange = onChange
  }

  return (
    <label
      className={cx(classes.root, disabled && classes.disabled, className)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {isValidElement(control) ? cloneElement(control, controlProps) : control}
      {label != null && (
        <span className={cx(classes.label, disabled && classes.labelDisabled)}>
          {label}
        </span>
      )}
    </label>
  )
}

export default memo(FormControlLabel)
