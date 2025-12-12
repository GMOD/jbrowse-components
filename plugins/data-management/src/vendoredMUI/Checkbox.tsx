'use client'

import * as React from 'react'

import composeClasses from '@mui/utils/composeClasses'
import clsx from 'clsx'

import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox'

import SwitchBase from './SwitchBase'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { styled } from '@mui/material/styles'
import { mergeSlotProps } from '@mui/material/utils'

import {
  capitalize,
  checkboxClasses,
  createSimplePaletteValueFilter,
  getCheckboxUtilityClass,
  memoTheme,
  rootShouldForwardProp,
} from './utils'

type OwnerState = {
  classes?: Record<string, string>
  indeterminate?: boolean
  color: string
  size: string
  disableRipple: boolean
}

const useUtilityClasses = (ownerState: OwnerState) => {
  const { classes, indeterminate, color, size } = ownerState
  const slots = {
    root: [
      'root',
      indeterminate && 'indeterminate',
      `color${capitalize(color)}`,
      `size${capitalize(size)}`,
    ],
  }
  const composedClasses = composeClasses(slots, getCheckboxUtilityClass, classes)
  return {
    ...classes,
    ...composedClasses,
  }
}

const CheckboxRoot = styled(SwitchBase, {
  shouldForwardProp: (prop: string) =>
    rootShouldForwardProp(prop) || prop === 'classes',
  name: 'MuiCheckbox',
  slot: 'Root',
  overridesResolver: (props, styles) => {
    const { ownerState } = props
    return [
      styles.root,
      ownerState.indeterminate && styles.indeterminate,
      styles[`size${capitalize(ownerState.size)}`],
      ownerState.color !== 'default' &&
        styles[`color${capitalize(ownerState.color)}`],
    ]
  },
})(
  memoTheme(({ theme }: { theme: any }) => ({
    color: (theme.vars || theme).palette.text.secondary,
    variants: [
      {
        props: {
          color: 'default',
          disableRipple: false,
        },
        style: {
          '&:hover': {
            backgroundColor: theme.alpha(
              (theme.vars || theme).palette.action.active,
              (theme.vars || theme).palette.action.hoverOpacity,
            ),
          },
        },
      },
      ...Object.entries(theme.palette)
        .filter(createSimplePaletteValueFilter())
        .map(([color]) => ({
          props: {
            color,
            disableRipple: false,
          },
          style: {
            '&:hover': {
              backgroundColor: theme.alpha(
                (theme.vars || theme).palette[color].main,
                (theme.vars || theme).palette.action.hoverOpacity,
              ),
            },
          },
        })),
      ...Object.entries(theme.palette)
        .filter(createSimplePaletteValueFilter())
        .map(([color]) => ({
          props: {
            color,
          },
          style: {
            [`&.${checkboxClasses.checked}, &.${checkboxClasses.indeterminate}`]:
              {
                color: (theme.vars || theme).palette[color].main,
              },
            [`&.${checkboxClasses.disabled}`]: {
              color: (theme.vars || theme).palette.action.disabled,
            },
          },
        })),
      {
        props: {
          disableRipple: false,
        },
        style: {
          '&:hover': {
            '@media (hover: none)': {
              backgroundColor: 'transparent',
            },
          },
        },
      },
    ],
  })),
)

const defaultCheckedIcon = <CheckBoxIcon />
const defaultIcon = <CheckBoxOutlineBlankIcon />
const defaultIndeterminateIcon = <IndeterminateCheckBoxIcon />

const Checkbox = React.forwardRef(function Checkbox(inProps: any, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: 'MuiCheckbox',
  })
  const {
    checkedIcon = defaultCheckedIcon,
    color = 'primary',
    icon: iconProp = defaultIcon,
    indeterminate = false,
    indeterminateIcon: indeterminateIconProp = defaultIndeterminateIcon,
    inputProps,
    size = 'medium',
    disableRipple = false,
    className,
    slots = {},
    slotProps = {},
    ...other
  } = props
  const icon = indeterminate ? indeterminateIconProp : iconProp
  const indeterminateIcon = indeterminate ? indeterminateIconProp : checkedIcon
  const ownerState = {
    ...props,
    disableRipple,
    color,
    indeterminate,
    size,
  }
  const classes = useUtilityClasses(ownerState)
  const externalInputProps = slotProps.input ?? inputProps

  return (
    <CheckboxRoot
      ref={ref}
      className={clsx(classes.root, className)}
      ownerState={ownerState}
      type="checkbox"
      icon={React.cloneElement(icon, {
        fontSize: icon.props.fontSize ?? size,
      })}
      checkedIcon={React.cloneElement(indeterminateIcon, {
        fontSize: indeterminateIcon.props.fontSize ?? size,
      })}
      disableRipple={disableRipple}
      slotProps={{
        input: mergeSlotProps(
          typeof externalInputProps === 'function'
            ? externalInputProps(ownerState)
            : externalInputProps,
          {
            'data-indeterminate': indeterminate,
          },
        ),
      }}
      classes={classes}
      {...other}
    />
  )
})

export default Checkbox
