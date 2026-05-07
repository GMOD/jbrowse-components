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
  return info ? (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 15, y: clientMouseCoord[1] }}
    >
      <div>{info}</div>
    </BaseTooltip>
  ) : null
})

export default FeatureTooltip
