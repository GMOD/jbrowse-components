import React from 'react'
import { observer } from 'mobx-react'

// locals
import Tooltip from '../../Tooltip'
import { toP } from '../../util'
import type { TooltipContentsComponent } from '../../Tooltip'
import type { Feature } from '@jbrowse/core/util'

const en = (n: number) => n.toLocaleString('en-US')

interface Props {
  feature: Feature
}

const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ feature }, ref) {
    const start = feature.get('start') + 1
    const end = feature.get('end')
    const refName = feature.get('refName')
    const name = feature.get('name')
    const loc = [
      refName,
      name,
      start === end ? en(start) : `${en(start)}..${en(end)}`,
    ]
      .filter(f => !!f)
      .join(':')

    return feature.get('summary') !== undefined ? (
      <div ref={ref}>
        {loc}
        <br />
        Max: {toP(feature.get('maxScore'))}
        <br />
        Avg: {toP(feature.get('score'))}
        <br />
        Min: {toP(feature.get('minScore'))}
      </div>
    ) : (
      <div ref={ref}>
        {loc}
        <br />
        {`${toP(feature.get('score'))}`}
      </div>
    )
  },
)

type Coord = [number, number]

const WiggleTooltip = observer(function (props: {
  model: {
    featureUnderMouse?: Feature
  }
  height: number
  offsetMouseCoord: Coord
  clientMouseCoord: Coord
  clientRect?: DOMRect
  TooltipContents?: TooltipContentsComponent
}) {
  return <Tooltip TooltipContents={TooltipContents} {...props} />
})
export default WiggleTooltip

export { default as Tooltip } from '../../Tooltip'
