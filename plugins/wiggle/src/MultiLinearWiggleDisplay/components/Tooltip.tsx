import { forwardRef } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Tooltip from '../../Tooltip'
import { toP } from '../../util'

import type { TooltipContentsComponent } from '../../Tooltip'
import type { Source } from '../../util'
import type { Feature } from '@jbrowse/core/util'

interface Props {
  model: { sources: Source[] }
  feature: Feature
}
const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ model, feature }, ref) {
    const start = feature.get('start')
    const end = feature.get('end')
    const refName = feature.get('refName')
    const coord =
      start === end ? toLocale(start) : `${toLocale(start)}..${toLocale(end)}`
    const sources = feature.get('sources') as
      | Record<string, { score: number }>
      | undefined
    const source = feature.get('source')
    const summary = feature.get('summary')
    const obj = Object.fromEntries(model.sources.map(ent => [ent.name, ent]))
    const obj2 = obj[source]

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
              {Object.entries(sources).map(([source, data]) => {
                const sourceInfo = obj[source]
                return (
                  <tr key={source}>
                    <td>
                      {sourceInfo && (
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            background: sourceInfo.color,
                          }}
                        ></div>
                      )}
                    </td>
                    <td>{sourceInfo?.name || source}</td>
                    <td>{toP(data.score)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <span>
            {obj2?.name || source}{' '}
            {summary
              ? `min:${toP(feature.get('minScore'))} avg:${toP(
                  feature.get('score'),
                )} max:${toP(feature.get('maxScore'))}`
              : toP(feature.get('score'))}
          </span>
        )}
      </div>
    )
  },
)

type Coord = [number, number]

const WiggleTooltip = observer(function (props: {
  model: { featureUnderMouse: Feature; sources: Source[]; rowHeight: number }
  height: number
  offsetMouseCoord: Coord
  clientMouseCoord: Coord
  TooltipContents?: TooltipContentsComponent
}) {
  return <Tooltip TooltipContents={TooltipContents} {...props} />
})

export default WiggleTooltip
