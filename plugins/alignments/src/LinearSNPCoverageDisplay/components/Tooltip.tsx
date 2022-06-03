/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Tooltip } from '@jbrowse/plugin-wiggle'

type Count = {
  [key: string]: {
    total: number
  }
}

type SNPInfo = {
  cov: Count
  lowqual: Count
  noncov: Count
  delskips: Count

  total: number
  ref: number
  all: number
  '-1': number
  '0': number
  '1': number
}

const en = (n: number) => n.toLocaleString('en-US')

const pct = (n: number, total: number) =>
  `${Math.round((n / (total || 1)) * 100)}%`

const TooltipContents = React.forwardRef(
  ({ feature }: { feature: Feature }, ref: any) => {
    const start = feature.get('start')
    const end = feature.get('end')
    const refbase = feature.get('refbase')
    const name = feature.get('refName')
    const info = feature.get('snpinfo') as SNPInfo
    const loc = [name, start === end ? en(start) : `${en(start)}..${en(end)}`]
      .filter(f => !!f)
      .join(':')
    const total = info?.all

    return (
      <div ref={ref}>
        <table>
          <caption>{loc}</caption>
          <thead>
            <tr>
              <th>Base</th>
              <th>Count</th>
              <th>% of Total</th>
              <th>Strands</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total</td>
              <td>{total}</td>
            </tr>
            <tr>
              <td>REF {refbase ? `(${refbase.toUpperCase()})` : ''}</td>
              <td>{info.ref}</td>
              <td>{pct(info.ref, total)}</td>
              <td>
                {info['-1'] ? `${info['-1']}(-)` : ''}
                {info['1'] ? `${info['1']}(+)` : ''}
              </td>
              <td />
            </tr>

            {Object.entries(info).map(([key, entry]) =>
              Object.entries(entry).map(([base, score]) => (
                <tr key={base}>
                  <td>{base.toUpperCase()}</td>
                  <td>{score.total}</td>
                  <td>
                    {base === 'total' || base === 'skip'
                      ? '---'
                      : pct(score.total, total)}
                  </td>
                  <td>
                    {score['-1'] ? `${score['-1']}(-)` : ''}
                    {score['1'] ? `${score['1']}(+)` : ''}
                  </td>
                  <td>{key}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    )
  },
)

type Coord = [number, number]

const SNPCoverageTooltip = observer(
  (props: {
    model: any
    height: number
    offsetMouseCoord: Coord
    clientMouseCoord: Coord
    clientRect?: DOMRect
  }) => {
    const { model } = props
    const { featureUnderMouse: feat } = model
    return feat && feat.get('type') === 'skip' ? null : (
      <Tooltip TooltipContents={TooltipContents} {...props} />
    )
  },
)

export default SNPCoverageTooltip
