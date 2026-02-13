import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

type Coord = [number, number]

const WebGLFeatureTooltip = observer(function WebGLFeatureTooltip({
  model,
  clientMouseCoord,
}: {
  model: {
    mouseoverExtraInformation: string | undefined
  }
  clientMouseCoord: Coord
}) {
  const { mouseoverExtraInformation } = model

  if (!mouseoverExtraInformation) {
    return null
  }

  return (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 15, y: clientMouseCoord[1] }}
    >
      <div>{mouseoverExtraInformation}</div>
    </BaseTooltip>
  )
})

export default WebGLFeatureTooltip
