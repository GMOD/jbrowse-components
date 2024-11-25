import React from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'
// locals
import type { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

interface Props {
  message: React.ReactNode | string
}
const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {React.isValidElement(message) ? (
          message
        ) : message ? (
          <SanitizedHTML html={String(message)} />
        ) : null}
      </div>
    )
  },
)

type Coord = [number, number]
const Tooltip = observer(function ({
  model,
  clientMouseCoord,
}: {
  model: BaseLinearDisplayModel
  clientMouseCoord: Coord
}) {
  const { featureUnderMouse } = model
  const x = clientMouseCoord[0] + 15
  const y = clientMouseCoord[1]

  const contents = featureUnderMouse
    ? getConf(model, 'mouseover', { feature: featureUnderMouse })
    : undefined

  return featureUnderMouse && contents ? (
    <BaseTooltip clientPoint={{ x, y }}>
      <TooltipContents message={contents} />
    </BaseTooltip>
  ) : null
})

export default Tooltip
