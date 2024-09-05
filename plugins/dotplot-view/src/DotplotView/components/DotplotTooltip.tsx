import React from 'react'
import { observer } from 'mobx-react'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'

// locals
import { DotplotViewModel } from '../model'
import { locstr } from './util'

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
  const { hview, vview, viewHeight } = model
  return mouserect ? (
    <BaseTooltip
      placement={xdistance < 0 ? 'left' : 'right'}
      clientPoint={
        mouserectClient
          ? { x: mouserectClient[0], y: mouserectClient[1] }
          : undefined
      }
    >
      {`x - ${locstr(mouserect[0], hview)}`}
      <br />
      {`y - ${locstr(viewHeight - mouserect[1], vview)}`}
      <br />
    </BaseTooltip>
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
  const { hview, vview, viewHeight } = model
  const x = (mousedownClient?.[0] || 0) - (xdistance < 0 ? 0 : 0)
  const y = (mousedownClient?.[1] || 0) - (ydistance < 0 ? 0 : 0)

  return mousedown && Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 ? (
    <BaseTooltip clientPoint={{ x, y }}>
      {`x - ${locstr(mousedown[0], hview)}`}
      <br />
      {`y - ${locstr(viewHeight - mousedown[1], vview)}`}
      <br />
    </BaseTooltip>
  ) : null
})
