import React from 'react'

import { observer } from 'mobx-react'

// locals
import Tooltip from '../../Tooltip'

import type { TooltipContentsComponent } from '../../Tooltip'
import type { Source } from '../../util'
import type { Feature } from '@jbrowse/core/util'

const en = (n: number) => n.toLocaleString('en-US')

interface Props {
  model: { sources: Source[] }
  feature: Feature
}
const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ model, feature }, ref) {
    const start = feature.get('start')
    const end = feature.get('end')
    const refName = feature.get('refName')
    const coord = start === end ? en(start) : `${en(start)}..${en(end)}`
    const sources = feature.get('sources') as
      | Record<string, { score: number }>
      | undefined
    const source = feature.get('source')
    const obj = Object.fromEntries(model.sources.map(ent => [ent.name, ent]))

    return (
      <div ref={ref}>
        {[refName, coord].filter(f => !!f).join(':')}
        <br />
        {sources ? (
          <table>
            <thead>
              <tr>
                <th>color</th>
                <th>source</th>
                <th>score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sources).map(([source, data]) => (
                <tr key={source}>
                  <td style={{ background: obj[source]?.color }}> </td>
                  <td>{source}</td>
                  <td>{data.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span>{source}</span>
        )}
      </div>
    )
  },
)

type Coord = [number, number]

const VariantTooltip = observer(
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
export default VariantTooltip

export { default as Tooltip } from '../../Tooltip'
