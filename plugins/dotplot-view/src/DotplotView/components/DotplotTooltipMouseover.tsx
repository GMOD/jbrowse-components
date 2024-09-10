import React from 'react'
import { observer } from 'mobx-react'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'

// locals
import { DotplotViewModel } from '../model'
import { locstr } from './util'

type Coord = [number, number] | undefined

const DotplotTooltipMouseover = observer(function ({
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
export default DotplotTooltipMouseover
