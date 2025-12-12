'use client'

import * as React from 'react'

import composeClasses from '@mui/utils/composeClasses'
import clsx from 'clsx'

import ButtonBase from '@mui/material/ButtonBase'
import CircularProgress from '@mui/material/CircularProgress'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { styled } from '@mui/material/styles'
import { unstable_useId as useId } from '@mui/material/utils'

import {
  capitalize,
  createSimplePaletteValueFilter,
  getIconButtonUtilityClass,
  iconButtonClasses,
  memoTheme,
} from './utils'

type OwnerState = {
  classes?: Record<string, string>
  disabled: boolean
  color: string
  edge: string | false
  size: string
  loading: boolean | null
}

const useUtilityClasses = (ownerState: OwnerState) => {
  const { classes, disabled, color, edge, size, loading } = ownerState
  const slots = {
    root: [
      'root',
      loading && 'loading',
      disabled && 'disabled',
      color !== 'default' && `color${capitalize(color)}`,
      edge && `edge${capitalize(edge)}`,
      `size${capitalize(size)}`,
    ],
    loadingIndicator: ['loadingIndicator'],
    loadingWrapper: ['loadingWrapper'],
  }
  return composeClasses(slots, getIconButtonUtilityClass, classes)
}

const IconButtonRoot = styled(ButtonBase, {
  name: 'MuiIconButton',
  slot: 'Root',
  overridesResolver: (props, styles) => {
    const { ownerState } = props
    return [
      styles.root,
      ownerState.loading && styles.loading,
      ownerState.color !== 'default' &&
        styles[`color${capitalize(ownerState.color)}`],
      ownerState.edge && styles[`edge${capitalize(ownerState.edge)}`],
      styles[`size${capitalize(ownerState.size)}`],
    ]
  },
})(
  memoTheme(({ theme }: { theme: any }) => ({
    textAlign: 'center',
    flex: '0 0 auto',
    fontSize: theme.typography.pxToRem(24),
    padding: 8,
    borderRadius: '50%',
    color: (theme.vars || theme).palette.action.active,
    transition: theme.transitions.create('background-color', {
      duration: theme.transitions.duration.shortest,
    }),
    variants: [
      {
        props: (props: any) => !props.disableRipple,
        style: {
          '--IconButton-hoverBg': theme.alpha(
            (theme.vars || theme).palette.action.active,
            (theme.vars || theme).palette.action.hoverOpacity,
          ),
          '&:hover': {
            backgroundColor: 'var(--IconButton-hoverBg)',
            '@media (hover: none)': {
              backgroundColor: 'transparent',
            },
          },
        },
      },
      {
        props: {
          edge: 'start',
        },
        style: {
          marginLeft: -12,
        },
      },
      {
        props: {
          edge: 'start',
          size: 'small',
        },
        style: {
          marginLeft: -3,
        },
      },
      {
        props: {
          edge: 'end',
        },
        style: {
          marginRight: -12,
        },
      },
      {
        props: {
          edge: 'end',
          size: 'small',
        },
        style: {
          marginRight: -3,
        },
      },
    ],
  })),
  memoTheme(({ theme }: { theme: any }) => ({
    variants: [
      {
        props: {
          color: 'inherit',
        },
        style: {
          color: 'inherit',
        },
      },
      ...Object.entries(theme.palette)
        .filter(createSimplePaletteValueFilter())
        .map(([color]) => ({
          props: {
            color,
          },
          style: {
            color: (theme.vars || theme).palette[color].main,
          },
        })),
      ...Object.entries(theme.palette)
        .filter(createSimplePaletteValueFilter())
        .map(([color]) => ({
          props: {
            color,
          },
          style: {
            '--IconButton-hoverBg': theme.alpha(
              (theme.vars || theme).palette[color].main,
              (theme.vars || theme).palette.action.hoverOpacity,
            ),
          },
        })),
      {
        props: {
          size: 'small',
        },
        style: {
          padding: 5,
          fontSize: theme.typography.pxToRem(18),
        },
      },
      {
        props: {
          size: 'large',
        },
        style: {
          padding: 12,
          fontSize: theme.typography.pxToRem(28),
        },
      },
    ],
    [`&.${iconButtonClasses.disabled}`]: {
      backgroundColor: 'transparent',
      color: (theme.vars || theme).palette.action.disabled,
    },
    [`&.${iconButtonClasses.loading}`]: {
      color: 'transparent',
    },
  })),
)

const IconButtonLoadingIndicator = styled('span', {
  name: 'MuiIconButton',
  slot: 'LoadingIndicator',
})(({ theme }: { theme: any }) => ({
  display: 'none',
  position: 'absolute',
  visibility: 'visible',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  color: (theme.vars || theme).palette.action.disabled,
  variants: [
    {
      props: {
        loading: true,
      },
      style: {
        display: 'flex',
      },
    },
  ],
}))

const IconButton = React.forwardRef(function IconButton(inProps: any, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: 'MuiIconButton',
  })
  const {
    edge = false,
    children,
    className,
    color = 'default',
    disabled = false,
    disableFocusRipple = false,
    size = 'medium',
    id: idProp,
    loading = null,
    loadingIndicator: loadingIndicatorProp,
    ...other
  } = props
  const loadingId = useId(idProp)
  const loadingIndicator = loadingIndicatorProp ?? (
    <CircularProgress aria-labelledby={loadingId} color="inherit" size={16} />
  )
  const ownerState = {
    ...props,
    edge,
    color,
    disabled,
    disableFocusRipple,
    loading,
    loadingIndicator,
    size,
  }
  const classes = useUtilityClasses(ownerState)
  return (
    <IconButtonRoot
      id={loading ? loadingId : idProp}
      className={clsx(classes.root, className)}
      centerRipple
      focusRipple={!disableFocusRipple}
      disabled={disabled || loading}
      ref={ref}
      {...other}
      ownerState={ownerState}
    >
      {typeof loading === 'boolean' && (
        <span className={classes.loadingWrapper} style={{ display: 'contents' }}>
          <IconButtonLoadingIndicator className={classes.loadingIndicator}>
            {loading && loadingIndicator}
          </IconButtonLoadingIndicator>
        </span>
      )}
      {children}
    </IconButtonRoot>
  )
})

export default IconButton
