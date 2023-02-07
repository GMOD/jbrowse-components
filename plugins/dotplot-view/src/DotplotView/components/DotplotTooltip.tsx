import React, { useRef } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { DotplotViewModel } from '../model'
import { locstr } from './util'

const useStyles = makeStyles()(theme => ({
  popover: {
    background: theme.palette.background.paper,
    maxWidth: 400,
    wordBreak: 'break-all',
    zIndex: 1000,
    border: `1px solid ${theme.palette.action.active}`,
    pointerEvents: 'none',
    position: 'absolute',
  },
}))

type Coord = [number, number] | undefined
const blank = { left: 0, top: 0, width: 0, height: 0 }

export const TooltipWhereMouseovered = observer(function ({
  model,
  mouserect,
  xdistance,
  ydistance,
}: {
  model: DotplotViewModel
  mouserect: Coord
  xdistance: number
  ydistance: number
}) {
  const { classes } = useStyles()
  const { hview, vview, viewHeight } = model
  const ref = useRef<HTMLDivElement>(null)
  const rect = ref.current?.getBoundingClientRect() || blank
  const offset = 6
  const w = rect.height + offset * 2
  return (
    <>
      {mouserect ? (
        <div
          ref={ref}
          className={classes.popover}
          style={{
            left: offset + mouserect[0] - (xdistance < 0 ? w : 0),
            top: offset + mouserect[1] - (ydistance < 0 ? w : 0),
          }}
        >
          {`x - ${locstr(mouserect[0], hview)}`}
          <br />
          {`y - ${locstr(viewHeight - mouserect[1], vview)}`}
          <br />
        </div>
      ) : null}
    </>
  )
})

export const TooltipWhereClicked = observer(function ({
  model,
  mousedown,
  xdistance,
  ydistance,
}: {
  model: DotplotViewModel
  mousedown: Coord
  xdistance: number
  ydistance: number
}) {
  const { classes } = useStyles()
  const { hview, vview, viewHeight } = model
  const ref = useRef<HTMLDivElement>(null)
  const rect = ref.current?.getBoundingClientRect() || blank
  return (
    <>
      {mousedown && Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 ? (
        <div
          ref={ref}
          className={classes.popover}
          style={{
            left: mousedown[0] - (xdistance < 0 ? 0 : rect.width),
            top: mousedown[1] - (ydistance < 0 ? 0 : rect.height),
          }}
        >
          {`x - ${locstr(mousedown[0], hview)}`}
          <br />
          {`y - ${locstr(viewHeight - mousedown[1], vview)}`}
          <br />
        </div>
      ) : null}
    </>
  )
})
