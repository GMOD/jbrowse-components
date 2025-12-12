import React, { forwardRef, useCallback, useState } from 'react'

import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox'

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  indeterminate?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
  style?: React.CSSProperties
  size?: 'small' | 'medium'
  color?: 'primary' | 'secondary' | 'default'
  slotProps?: {
    input?: Record<string, unknown>
  }
  inputProps?: Record<string, unknown>
}

const rootStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  boxSizing: 'border-box',
  backgroundColor: 'transparent',
  outline: 0,
  border: 0,
  margin: 0,
  borderRadius: '50%',
  padding: 9,
  cursor: 'pointer',
  userSelect: 'none',
  verticalAlign: 'middle',
  textDecoration: 'none',
  color: 'inherit',
}

const inputStyle: React.CSSProperties = {
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
}

const Checkbox = forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  {
    checked: checkedProp,
    defaultChecked,
    disabled = false,
    indeterminate = false,
    onChange,
    className,
    style,
    size = 'medium',
    color = 'primary',
    slotProps,
    inputProps: inputPropsProp,
  },
  ref,
) {
  const isControlled = checkedProp !== undefined
  const [checkedState, setCheckedState] = useState(defaultChecked ?? false)
  const checked = isControlled ? checkedProp : checkedState

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setCheckedState(event.target.checked)
      }
      onChange?.(event)
    },
    [isControlled, onChange],
  )

  const iconFontSize = size === 'small' ? 'small' : 'medium'
  const inputProps = slotProps?.input ?? inputPropsProp

  let iconColor: string | undefined
  if (checked || indeterminate) {
    iconColor =
      color === 'primary'
        ? '#1976d2'
        : color === 'secondary'
          ? '#9c27b0'
          : undefined
  }

  const Icon = indeterminate
    ? IndeterminateCheckBoxIcon
    : checked
      ? CheckBoxIcon
      : CheckBoxOutlineBlankIcon

  return (
    <span
      ref={ref}
      className={className}
      style={{
        ...rootStyle,
        ...style,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        style={inputStyle}
        data-indeterminate={indeterminate}
        {...inputProps}
      />
      <Icon
        fontSize={iconFontSize}
        style={{
          color: disabled ? 'rgba(0, 0, 0, 0.26)' : iconColor,
        }}
      />
    </span>
  )
})

export default Checkbox
