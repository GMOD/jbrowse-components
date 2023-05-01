import React, { useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { DotplotViewModel } from '../model'
import { locstr } from './util'
import { Portal, alpha } from '@mui/material'
import { usePopper } from 'react-popper'

export function round(value: number) {
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
const blank = { left: 0, top: 0, width: 0, height: 0 }

export const TooltipWhereMouseovered = observer(function ({
  model,
  mouserect,
  mouserectClient,
  xdistance,
  ydistance,
}: {
  model: DotplotViewModel
  mouserect: Coord
  mouserectClient: Coord
  xdistance: number
  ydistance: number
}) {
  const { classes } = useStyles()
  const { hview, vview, viewHeight } = model
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const rect = ref.current?.getBoundingClientRect() || blank
  const offset = 6
  const w = rect.height + offset * 2

  // must be memoized a la https://github.com/popperjs/react-popper/issues/391
  const virtElement = useMemo(
    () => ({
      getBoundingClientRect: () => {
        const x = offset + (mouserectClient?.[0] || 0) - (xdistance < 0 ? w : 0)
        const y = offset + (mouserectClient?.[1] || 0) - (ydistance < 0 ? w : 0)
        return {
          top: y,
          left: x,
          bottom: y,
          right: x,
          width: 0,
          height: 0,
          x,
          y,
          toJSON() {},
        }
      },
    }),
    [mouserectClient, xdistance, ydistance, w],
  )
  const { styles, attributes } = usePopper(virtElement, anchorEl, {
    placement: xdistance < 0 ? 'left' : 'right',
  })
  return (
    <>
      {mouserect ? (
        <Portal>
          <div
            ref={setAnchorEl}
            className={classes.tooltip}
            // zIndex needed to go over widget drawer
            style={{ ...styles.popper, zIndex: 100000 }}
            {...attributes.popper}
          >
            {`x - ${locstr(mouserect[0], hview)}`}
            <br />
            {`y - ${locstr(viewHeight - mouserect[1], vview)}`}
            <br />
          </div>
        </Portal>
      ) : null}
    </>
  )
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
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)

  // must be memoized a la https://github.com/popperjs/react-popper/issues/391
  const virtElement = useMemo(
    () => ({
      getBoundingClientRect: () => {
        const x = (mousedownClient?.[0] || 0) - (xdistance < 0 ? 0 : 0)
        const y = (mousedownClient?.[1] || 0) - (ydistance < 0 ? 0 : 0)
        return {
          top: y,
          left: x,
          bottom: y,
          right: x,
          width: 0,
          height: 0,
          x,
          y,
          toJSON() {},
        }
      },
    }),
    [mousedownClient, xdistance, ydistance],
  )
  const { styles, attributes } = usePopper(virtElement, anchorEl, {
    placement: xdistance < 0 ? 'right' : 'left',
  })
  return (
    <>
      {mousedown && Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 ? (
        <Portal>
          <div
            ref={setAnchorEl}
            className={classes.tooltip}
            // zIndex needed to go over widget drawer
            style={{ ...styles.popper, zIndex: 100000 }}
            {...attributes.popper}
          >
            {`x - ${locstr(mousedown[0], hview)}`}
            <br />
            {`y - ${locstr(viewHeight - mousedown[1], vview)}`}
            <br />
          </div>
        </Portal>
      ) : null}
    </>
  )
})
