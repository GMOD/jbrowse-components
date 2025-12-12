'use client'

import * as React from 'react'

import composeClasses from '@mui/utils/composeClasses'

import ButtonBase from '@mui/material/ButtonBase'
import { useFormControl } from '@mui/material/FormControl'
import { styled } from '@mui/material/styles'
import { useControlled } from '@mui/material/utils'

import { capitalize, rootShouldForwardProp } from './utils'

function getSwitchBaseUtilityClass(slot: string) {
  return `MuiSwitchBase-${slot}`
}

type OwnerState = {
  classes?: Record<string, string>
  checked: boolean
  disabled?: boolean
  edge: string | false
}

const useUtilityClasses = (ownerState: OwnerState) => {
  const { classes, checked, disabled, edge } = ownerState
  const slots = {
    root: [
      'root',
      checked && 'checked',
      disabled && 'disabled',
      edge && `edge${capitalize(edge)}`,
    ],
    input: ['input'],
  }
  return composeClasses(slots, getSwitchBaseUtilityClass, classes)
}

const SwitchBaseRoot = styled(ButtonBase, {
  name: 'MuiSwitchBase',
})({
  padding: 9,
  borderRadius: '50%',
  variants: [
    {
      props: { edge: 'start', size: 'small' },
      style: { marginLeft: -3 },
    },
    {
      props: ({ edge, ownerState }: any) =>
        edge === 'start' && ownerState.size !== 'small',
      style: { marginLeft: -12 },
    },
    {
      props: { edge: 'end', size: 'small' },
      style: { marginRight: -3 },
    },
    {
      props: ({ edge, ownerState }: any) =>
        edge === 'end' && ownerState.size !== 'small',
      style: { marginRight: -12 },
    },
  ],
})

const SwitchBaseInput = styled('input', {
  name: 'MuiSwitchBase',
  shouldForwardProp: rootShouldForwardProp,
})({
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
})

const SwitchBase = React.forwardRef(function SwitchBase(props: any, ref) {
  const {
    autoFocus,
    checked: checkedProp,
    checkedIcon,
    className,
    defaultChecked,
    disabled: disabledProp,
    disableFocusRipple = false,
    edge = false,
    icon,
    id,
    inputProps,
    inputRef,
    name,
    onBlur,
    onChange,
    onFocus,
    readOnly,
    required = false,
    tabIndex,
    type,
    value,
    slotProps = {},
    ...other
  } = props

  const [checked, setCheckedState] = useControlled({
    controlled: checkedProp,
    default: Boolean(defaultChecked),
    name: 'SwitchBase',
    state: 'checked',
  })

  const muiFormControl = useFormControl()

  const handleFocus = (event: React.FocusEvent) => {
    onFocus?.(event)
    muiFormControl?.onFocus?.(event as any)
  }

  const handleBlur = (event: React.FocusEvent) => {
    onBlur?.(event)
    muiFormControl?.onBlur?.(event as any)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.nativeEvent.defaultPrevented) {
      return
    }
    const newChecked = event.target.checked
    setCheckedState(newChecked)
    onChange?.(event, newChecked)
  }

  let disabled = disabledProp
  if (muiFormControl) {
    if (typeof disabled === 'undefined') {
      disabled = muiFormControl.disabled
    }
  }

  const hasLabelFor = type === 'checkbox' || type === 'radio'

  const ownerState = {
    ...props,
    checked,
    disabled,
    disableFocusRipple,
    edge,
  }

  const classes = useUtilityClasses(ownerState)

  const mergedInputProps = {
    ...inputProps,
    ...slotProps.input,
  }

  return (
    <SwitchBaseRoot
      component="span"
      className={`${classes.root}${className ? ` ${className}` : ''}`}
      centerRipple
      focusRipple={!disableFocusRipple}
      disabled={disabled}
      tabIndex={null}
      role={undefined}
      onFocus={handleFocus}
      onBlur={handleBlur}
      ownerState={ownerState}
      ref={ref}
      {...other}
    >
      <SwitchBaseInput
        autoFocus={autoFocus}
        checked={checkedProp}
        defaultChecked={defaultChecked}
        className={classes.input}
        disabled={disabled}
        id={hasLabelFor ? id : undefined}
        name={name}
        onChange={handleInputChange}
        readOnly={readOnly}
        ref={inputRef}
        required={required}
        ownerState={ownerState}
        tabIndex={tabIndex}
        type={type}
        {...(type === 'checkbox' && value === undefined ? {} : { value })}
        {...mergedInputProps}
      />
      {checked ? checkedIcon : icon}
    </SwitchBaseRoot>
  )
})

export default SwitchBase
