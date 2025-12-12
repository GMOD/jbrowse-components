'use client'

import * as React from 'react'

import composeClasses from '@mui/utils/composeClasses'
import clsx from 'clsx'

import { useFormControl } from '@mui/material/FormControl'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'

import {
  capitalize,
  formControlLabelClasses,
  formControlState,
  getFormControlLabelUtilityClasses,
  memoTheme,
} from './utils'

type OwnerState = {
  classes?: Record<string, string>
  disabled?: boolean
  labelPlacement: string
  error?: boolean
  required?: boolean
}

const useUtilityClasses = (ownerState: OwnerState) => {
  const { classes, disabled, labelPlacement, error, required } = ownerState
  const slots = {
    root: [
      'root',
      disabled && 'disabled',
      `labelPlacement${capitalize(labelPlacement)}`,
      error && 'error',
      required && 'required',
    ],
    label: ['label', disabled && 'disabled'],
    asterisk: ['asterisk', error && 'error'],
  }
  return composeClasses(slots, getFormControlLabelUtilityClasses, classes)
}

export const FormControlLabelRoot = styled('label', {
  name: 'MuiFormControlLabel',
  slot: 'Root',
  overridesResolver: (props, styles) => {
    const { ownerState } = props
    return [
      {
        [`& .${formControlLabelClasses.label}`]: styles.label,
      },
      styles.root,
      styles[`labelPlacement${capitalize(ownerState.labelPlacement)}`],
    ]
  },
})(
  memoTheme(({ theme }: { theme: any }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    verticalAlign: 'middle',
    WebkitTapHighlightColor: 'transparent',
    marginLeft: -11,
    marginRight: 16,
    [`&.${formControlLabelClasses.disabled}`]: {
      cursor: 'default',
    },
    [`& .${formControlLabelClasses.label}`]: {
      [`&.${formControlLabelClasses.disabled}`]: {
        color: (theme.vars || theme).palette.text.disabled,
      },
    },
    variants: [
      {
        props: {
          labelPlacement: 'start',
        },
        style: {
          flexDirection: 'row-reverse',
          marginRight: -11,
        },
      },
      {
        props: {
          labelPlacement: 'top',
        },
        style: {
          flexDirection: 'column-reverse',
        },
      },
      {
        props: {
          labelPlacement: 'bottom',
        },
        style: {
          flexDirection: 'column',
        },
      },
      {
        props: ({ labelPlacement }: { labelPlacement: string }) =>
          labelPlacement === 'start' ||
          labelPlacement === 'top' ||
          labelPlacement === 'bottom',
        style: {
          marginLeft: 16,
        },
      },
    ],
  })),
)

const AsteriskComponent = styled('span', {
  name: 'MuiFormControlLabel',
  slot: 'Asterisk',
})(
  memoTheme(({ theme }: { theme: any }) => ({
    [`&.${formControlLabelClasses.error}`]: {
      color: (theme.vars || theme).palette.error.main,
    },
  })),
)

const FormControlLabel = React.forwardRef(function FormControlLabel(
  inProps: any,
  ref,
) {
  const props = useDefaultProps({
    props: inProps,
    name: 'MuiFormControlLabel',
  })
  const {
    checked,
    className,
    control,
    disabled: disabledProp,
    disableTypography,
    inputRef,
    label: labelProp,
    labelPlacement = 'end',
    name,
    onChange,
    required: requiredProp,
    value,
    ...other
  } = props
  const muiFormControl = useFormControl()
  const disabled = disabledProp ?? control.props.disabled ?? muiFormControl?.disabled
  const required = requiredProp ?? control.props.required
  const controlProps: Record<string, any> = {
    disabled,
    required,
  }
  ;['checked', 'name', 'onChange', 'value', 'inputRef'].forEach(key => {
    if (
      typeof control.props[key] === 'undefined' &&
      typeof props[key] !== 'undefined'
    ) {
      controlProps[key] = props[key]
    }
  })
  const fcs = formControlState({
    props,
    muiFormControl,
    states: ['error'],
  })
  const ownerState = {
    ...props,
    disabled,
    labelPlacement,
    required,
    error: fcs.error,
  }
  const classes = useUtilityClasses(ownerState)

  let label = labelProp
  if (label != null && label.type !== Typography && !disableTypography) {
    label = (
      <Typography component="span" className={classes.label}>
        {label}
      </Typography>
    )
  }
  return (
    <FormControlLabelRoot
      className={clsx(classes.root, className)}
      ownerState={ownerState}
      ref={ref}
      {...other}
    >
      {React.cloneElement(control, controlProps)}
      {required ? (
        <div>
          {label}
          <AsteriskComponent aria-hidden className={classes.asterisk}>
            {'\u2009'}
            {'*'}
          </AsteriskComponent>
        </div>
      ) : (
        label
      )}
    </FormControlLabelRoot>
  )
})

export default FormControlLabel
