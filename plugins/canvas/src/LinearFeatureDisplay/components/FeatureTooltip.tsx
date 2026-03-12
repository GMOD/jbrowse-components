import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

type Coord = [number, number]

const FeatureTooltip = observer(function FeatureTooltip({
  info,
  clientMouseCoord,
}: {
  info: string | undefined
  clientMouseCoord: Coord
}) {
  if (!info) {
    return null
  }
  return (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 15, y: clientMouseCoord[1] }}
    >
      <div>{info}</div>
    </BaseTooltip>
  )
})

export default FeatureTooltip
