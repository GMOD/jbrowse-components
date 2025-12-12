import React, { cloneElement, forwardRef, isValidElement } from 'react'

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
}

const FormControlLabel = forwardRef<HTMLLabelElement, FormControlLabelProps>(
  function FormControlLabel(
    { control, label, className, disabled: disabledProp, onChange, onClick },
    ref,
  ) {
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
        ref={ref}
        className={cx(classes.root, disabled && classes.disabled, className)}
        onClick={onClick}
      >
        {isValidElement(control) ? cloneElement(control, controlProps) : control}
        {label != null && (
          <span className={cx(classes.label, disabled && classes.labelDisabled)}>
            {label}
          </span>
        )}
      </label>
    )
  },
)

export default FormControlLabel
