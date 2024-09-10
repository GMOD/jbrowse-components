import React, { lazy, Suspense } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
// locals
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

const BaseTooltip = lazy(() => import('@jbrowse/core/ui/BaseTooltip'))

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
    <Suspense fallback={null}>
      <BaseTooltip clientPoint={{ x, y }}>
        <TooltipContents message={contents} />
      </BaseTooltip>
    </Suspense>
  ) : null
})

export default Tooltip
