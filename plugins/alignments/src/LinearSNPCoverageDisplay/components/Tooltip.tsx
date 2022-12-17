import React from 'react'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util'
import { Tooltip } from '@jbrowse/plugin-wiggle'

type Count = {
  [key: string]: {
    total: number
    '-1': number
    '0': number
    '1': number
  }
}

type SNPInfo = {
  cov: Count
  lowqual: Count
  noncov: Count
  delskips: Count
  refbase: string
  total: number
  ref: number
  all: number
  '-1': number
  '0': number
  '1': number
}

const en = (n: number) => n.toLocaleString('en-US')
const toP = (s = 0) => +(+s).toFixed(1)
const pct = (n: number, total: number) => `${toP((n / (total || 1)) * 100)}%`
interface Props {
  feature: Feature
}
const TooltipContents = React.forwardRef<HTMLDivElement, Props>(function (
  { feature },
  reactRef,
) {
  const start = feature.get('start')
  const end = feature.get('end')
  const name = feature.get('refName')
  const {
    refbase,
    all,
    total,
    ref,
    '-1': rn1,
    '1': r1,
    '0': r0,
    ...info
  } = feature.get('snpinfo') as SNPInfo
  const loc = [name, start === end ? en(start) : `${en(start)}..${en(end)}`]
    .filter(f => !!f)
    .join(':')

  return (
    <div ref={reactRef}>
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
            <td>{all}</td>
          </tr>
          <tr>
            <td>REF {refbase ? `(${refbase.toUpperCase()})` : ''}</td>
            <td>{ref}</td>
            <td>{pct(ref, all)}</td>
            <td>
              {rn1 ? `${rn1}(-)` : ''}
              {r1 ? `${r1}(+)` : ''}
            </td>
            <td />
          </tr>

          {Object.entries(info as unknown as Record<string, Count>).map(
            ([key, entry]) =>
              Object.entries(entry).map(([base, score]) => (
                <tr key={base}>
                  <td>{base.toUpperCase()}</td>
                  <td>{score.total}</td>
                  <td>
                    {base === 'total' || base === 'skip'
                      ? '---'
                      : pct(score.total, all)}
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
})

type Coord = [number, number]

const SNPCoverageTooltip = observer(
  (props: {
    model: { featureUnderMouse: Feature }
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
