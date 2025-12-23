import { forwardRef } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Tooltip from '../../Tooltip'
import { toP } from '../../util'

import type { TooltipContentsComponent } from '../../Tooltip'
import type { Feature } from '@jbrowse/core/util'

const en = toLocale

interface Props {
  feature: Feature
}

const TooltipContents = forwardRef<HTMLDivElement, Props>(
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

    const minScore = feature.get('minScore')
    const maxScore = feature.get('maxScore')
    const hasSummary = feature.get('summary') && minScore != null

    return hasSummary ? (
      <div ref={ref}>
        {loc}
        <br />
        Max: {toP(maxScore)}
        <br />
        Avg: {toP(feature.get('score'))}
        <br />
        Min: {toP(minScore)}
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

const WiggleTooltip = observer(function WiggleTooltip(props: {
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
