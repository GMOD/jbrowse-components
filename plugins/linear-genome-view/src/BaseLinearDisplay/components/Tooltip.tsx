import { forwardRef, isValidElement, useMemo } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

interface Props {
  message: React.ReactNode | string
}
const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {isValidElement(message) ? (
          message
        ) : message ? (
          <SanitizedHTML html={String(message)} />
        ) : null}
      </div>
    )
  },
)

type Coord = [number, number]

const Tooltip = observer(function Tooltip({
  model,
  clientMouseCoord,
}: {
  model: {
    featureUnderMouse: Feature | undefined
    featureIdUnderMouse: string | undefined
    mouseoverExtraInformation: string | undefined
    configuration: AnyConfigurationModel
  }
  clientMouseCoord: Coord
}) {
  const { featureUnderMouse, featureIdUnderMouse, mouseoverExtraInformation } =
    model
  const x = clientMouseCoord[0] + 15
  const y = clientMouseCoord[1]

  const contents = useMemo(
    () =>
      featureUnderMouse && mouseoverExtraInformation
        ? getConf(model, 'mouseover', {
            feature: featureUnderMouse,
            mouseoverExtraInformation,
          })
        : undefined,
    [featureUnderMouse, model, mouseoverExtraInformation],
  )

  return featureIdUnderMouse && contents ? (
    <BaseTooltip clientPoint={{ x, y }}>
      <TooltipContents message={contents} />
    </BaseTooltip>
  ) : null
})

export default Tooltip
