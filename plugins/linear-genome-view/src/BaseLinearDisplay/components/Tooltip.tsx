import { isValidElement } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

type Coord = [number, number]

interface TooltipModel {
  featureUnderMouse: Feature | undefined
  configuration: AnyConfigurationModel
}

function getTooltipContents(model: TooltipModel) {
  const { featureUnderMouse } = model
  return featureUnderMouse
    ? getConf(model, 'mouseover', { feature: featureUnderMouse })
    : undefined
}

function TooltipContents({ message }: { message: React.ReactNode }) {
  return (
    <div>
      {isValidElement(message) ? (
        message
      ) : message ? (
        <SanitizedHTML html={String(message)} />
      ) : null}
    </div>
  )
}

const Tooltip = observer(function Tooltip({
  model,
  clientMouseCoord,
}: {
  model: TooltipModel
  clientMouseCoord: Coord
}) {
  const contents = getTooltipContents(model)
  const x = clientMouseCoord[0] + 15
  const y = clientMouseCoord[1]

  return contents ? (
    <BaseTooltip clientPoint={{ x, y }}>
      <TooltipContents message={contents} />
    </BaseTooltip>
  ) : null
})

export default Tooltip
