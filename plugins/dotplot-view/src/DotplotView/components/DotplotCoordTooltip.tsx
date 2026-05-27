import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import { locstr } from './util.ts'

import type { DotplotViewModel } from '../model.ts'

const DotplotCoordTooltip = observer(function DotplotCoordTooltip({
  model,
  coord,
  clientCoord,
  placement,
}: {
  model: DotplotViewModel
  coord: [number, number]
  clientCoord: [number, number] | undefined
  placement: 'left' | 'right'
}) {
  const { hview, vview, viewHeight } = model
  return (
    <BaseTooltip
      placement={placement}
      clientPoint={
        clientCoord ? { x: clientCoord[0], y: clientCoord[1] } : undefined
      }
    >
      {`x - ${locstr(coord[0], hview)}`}
      <br />
      {`y - ${locstr(viewHeight - coord[1], vview)}`}
      <br />
    </BaseTooltip>
  )
})

export default DotplotCoordTooltip
