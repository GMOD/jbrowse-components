import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import { locstr } from './util.ts'

import type { DotplotViewModel } from '../model.ts'
import type { PointerSample } from './useDotplotInteraction.ts'

const DotplotCoordTooltip = observer(function DotplotCoordTooltip({
  model,
  point,
  placement,
}: {
  model: DotplotViewModel
  point: PointerSample
  placement: 'left' | 'right'
}) {
  const { hview, vview, viewHeight } = model
  return (
    <BaseTooltip
      placement={placement}
      clientPoint={{ x: point.clientX, y: point.clientY }}
    >
      {`x - ${locstr(point.x, hview)}`}
      <br />
      {`y - ${locstr(viewHeight - point.y, vview)}`}
    </BaseTooltip>
  )
})

export default DotplotCoordTooltip
