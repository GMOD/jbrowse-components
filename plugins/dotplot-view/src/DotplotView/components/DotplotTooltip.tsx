import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { DotplotViewModel } from '../model'
import { locstr } from './util'
import { Portal, alpha, useTheme } from '@mui/material'
import {
  useFloating,
  useClientPoint,
  useInteractions,
} from '@floating-ui/react'

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

type Coord = [number, number] | undefined

export const TooltipWhereMouseovered = observer(function ({
  model,
  mouserect,
  mouserectClient,
  xdistance,
}: {
  model: DotplotViewModel
  mouserect: Coord
  mouserectClient: Coord
  xdistance: number
}) {
  const { classes } = useStyles()
  const { hview, vview, viewHeight } = model
  const theme = useTheme()

  const { refs, floatingStyles, context } = useFloating({
    placement: xdistance < 0 ? 'left' : 'right',
  })

  const clientPoint = useClientPoint(
    context,
    mouserectClient
      ? {
          x: mouserectClient[0],
          y: mouserectClient[1],
        }
      : undefined,
  )
  const { getFloatingProps } = useInteractions([clientPoint])

  const popperTheme = theme?.components?.MuiPopper

  return mouserect ? (
    <Portal container={popperTheme?.defaultProps?.container}>
      <div
        className={classes.tooltip}
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 100000,
          pointerEvents: 'none',
        }}
        {...getFloatingProps()}
      >
        {`x - ${locstr(mouserect[0], hview)}`}
        <br />
        {`y - ${locstr(viewHeight - mouserect[1], vview)}`}
        <br />
      </div>
    </Portal>
  ) : null
})

export const TooltipWhereClicked = observer(function ({
  model,
  mousedown,
  mousedownClient,
  xdistance,
  ydistance,
}: {
  model: DotplotViewModel
  mousedown: Coord
  mousedownClient: Coord
  xdistance: number
  ydistance: number
}) {
  const { classes } = useStyles()
  const { hview, vview, viewHeight } = model
  const theme = useTheme()
  const x = (mousedownClient?.[0] || 0) - (xdistance < 0 ? 0 : 0)
  const y = (mousedownClient?.[1] || 0) - (ydistance < 0 ? 0 : 0)

  const { refs, floatingStyles, context } = useFloating({
    placement: xdistance < 0 ? 'right' : 'left',
  })

  const clientPoint = useClientPoint(context, { x, y })
  const { getFloatingProps } = useInteractions([clientPoint])

  const popperTheme = theme?.components?.MuiPopper
  return mousedown && Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 ? (
    <Portal container={popperTheme?.defaultProps?.container}>
      <div
        className={classes.tooltip}
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 100000,
          pointerEvents: 'none',
        }}
        {...getFloatingProps()}
      >
        {`x - ${locstr(mousedown[0], hview)}`}
        <br />
        {`y - ${locstr(viewHeight - mousedown[1], vview)}`}
        <br />
      </div>
    </Portal>
  ) : null
})
