import React, { cloneElement, forwardRef, isValidElement } from 'react'

export interface FormControlLabelProps {
  control: React.ReactElement
  label?: React.ReactNode
  checked?: boolean
  disabled?: boolean
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom'
  onChange?: (event: React.SyntheticEvent) => void
  value?: unknown
  name?: string
  inputRef?: React.Ref<HTMLInputElement>
  className?: string
  style?: React.CSSProperties
  onClick?: (event: React.MouseEvent<HTMLLabelElement>) => void
}

const rootStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'pointer',
  verticalAlign: 'middle',
  WebkitTapHighlightColor: 'transparent',
  marginLeft: -11,
  marginRight: 16,
}

const labelPlacementStyles: Record<string, React.CSSProperties> = {
  start: { flexDirection: 'row-reverse', marginRight: -11, marginLeft: 16 },
  top: { flexDirection: 'column-reverse', marginLeft: 16 },
  bottom: { flexDirection: 'column', marginLeft: 16 },
  end: {},
}

const labelStyle: React.CSSProperties = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontWeight: 400,
  fontSize: '1rem',
  lineHeight: 1.5,
  letterSpacing: '0.00938em',
}

const FormControlLabel = forwardRef<HTMLLabelElement, FormControlLabelProps>(
  function FormControlLabel(
    {
      control,
      label,
      checked,
      disabled: disabledProp,
      labelPlacement = 'end',
      onChange,
      value,
      name,
      inputRef,
      className,
      style,
      onClick,
    },
    ref,
  ) {
    const disabled =
      disabledProp ??
      (isValidElement(control) ? control.props.disabled : false)

    const controlProps: Record<string, unknown> = { disabled }

    if (checked !== undefined) {
      controlProps.checked = checked
    }
    if (name !== undefined && isValidElement(control)) {
      controlProps.name = name
    }
    if (onChange !== undefined) {
      controlProps.onChange = onChange
    }
    if (value !== undefined) {
      controlProps.value = value
    }
    if (inputRef !== undefined) {
      controlProps.inputRef = inputRef
    }

    const placementStyle = labelPlacementStyles[labelPlacement]

    return (
      <label
        ref={ref}
        className={className}
        style={{
          ...rootStyle,
          ...placementStyle,
          cursor: disabled ? 'default' : 'pointer',
          ...style,
        }}
        onClick={onClick}
      >
        {isValidElement(control) ? cloneElement(control, controlProps) : control}
        {label != null && (
          <span
            style={{
              ...labelStyle,
              color: disabled ? 'rgba(0, 0, 0, 0.38)' : undefined,
            }}
          >
            {label}
          </span>
        )}
      </label>
    )
  },
)

export default FormControlLabel
