import React from 'react'
import {
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { alpha, Portal, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const useStyles = makeStyles()(theme => ({
  // these styles come from
  // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tooltip/Tooltip.js
  tooltip: {
    position: 'absolute',
    pointerEvents: 'none',
    backgroundColor: alpha(theme.palette.grey[700], 0.9),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.common.white,
    fontFamily: theme.typography.fontFamily,
    padding: '4px 8px',
    fontSize: theme.typography.pxToRem(12),
    lineHeight: `${round(14 / 10)}em`,
    maxWidth: 300,
    wordWrap: 'break-word',
  },
}))

export default function BaseTooltip({
  clientPoint: clientPointCoords,
  children,
  placement = 'right',
}: {
  placement?: 'left' | 'right'
  clientPoint?: { x: number; y: number }
  children: React.ReactNode
}) {
  const theme = useTheme()
  const popperTheme = theme.components?.MuiPopper
  const { classes } = useStyles()
  const { refs, floatingStyles, context } = useFloating({
    placement,
    strategy: 'fixed',
  })

  const clientPoint = useClientPoint(context, clientPointCoords)
  const { getFloatingProps } = useInteractions([clientPoint])
  return (
    <Portal container={popperTheme?.defaultProps?.container}>
      <div
        className={classes.tooltip}
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 100000,
          // workaround for tooltips flashing at top left corner of screen
          // when first appearing
          visibility:
            floatingStyles.transform === 'translate(0px, 0px)'
              ? 'hidden'
              : undefined,
          pointerEvents: 'none',
        }}
        {...getFloatingProps()}
      >
        {children}
      </div>
    </Portal>
  )
}
