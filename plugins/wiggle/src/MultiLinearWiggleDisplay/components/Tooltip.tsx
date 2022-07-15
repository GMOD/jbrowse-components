import React from 'react'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util'

// locals
import { Source, toP } from '../../util'
import Tooltip, { TooltipContentsComponent } from '../../Tooltip'

const en = (n: number) => n.toLocaleString('en-US')

const TooltipContents = React.forwardRef<HTMLDivElement, { feature: Feature }>(
  ({ feature }: { feature: Feature }, ref) => {
    const start = feature.get('start')
    const end = feature.get('end')
    const refName = feature.get('refName')
    const coord = start === end ? en(start) : `${en(start)}..${en(end)}`
    const sources = feature.get('sources') as Record<string, { score: number }>
    const source = feature.get('source')

    return (
      <div ref={ref}>
        {[refName, coord].filter(f => !!f).join(':')}
        <br />
        {sources ? (
          Object.entries(sources).map(([source, data]) => (
            <span key={source} style={{ display: 'block' }}>
              {source} {toP(data.score)}
            </span>
          ))
        ) : (
          <span>
            {source} {toP(feature.get('score'))}
          </span>
        )}
      </div>
    )
  },
)

type Coord = [number, number]

const WiggleTooltip = observer(
  (props: {
    model: { featureUnderMouse: Feature; sources: Source[]; rowHeight: number }
    height: number
    offsetMouseCoord: Coord
    clientMouseCoord: Coord
    clientRect?: DOMRect
    TooltipContents?: TooltipContentsComponent
  }) => {
    return <Tooltip useClientY TooltipContents={TooltipContents} {...props} />
  },
)
export default WiggleTooltip
export { Tooltip }
