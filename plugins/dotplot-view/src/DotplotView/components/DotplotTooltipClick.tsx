import React from 'react'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

// locals
import { locstr } from './util'
import type { DotplotViewModel } from '../model'

type Coord = [number, number] | undefined
export const DotplotTooltipClick = observer(function ({
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
    <BaseTooltip
      placement={xdistance < 0 ? 'right' : 'left'}
      clientPoint={{ x, y }}
    >
      {`x - ${locstr(mousedown[0], hview)}`}
      <br />
      {`y - ${locstr(viewHeight - mousedown[1], vview)}`}
      <br />
    </BaseTooltip>
  ) : null
})

export default DotplotTooltipClick
