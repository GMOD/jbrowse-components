import React from 'react'
import { observer } from 'mobx-react'
import { Feature, toLocale } from '@jbrowse/core/util'
import { Tooltip } from '@jbrowse/plugin-wiggle'

// locals
import { BaseCoverageBin } from '../../shared/types'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(() => ({
  td: {
    whiteSpace: 'nowrap',
  },
}))

const toP = (s = 0) => +(+s).toFixed(1)

const pct = (n: number, total = 1) => `${toP((n / (total || 1)) * 100)}%`

interface Props {
  feature: Feature
}

const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ feature }, reactRef) {
    const { classes } = useStyles()
    const start = feature.get('start') + 1
    const end = feature.get('end')
    const name = feature.get('refName')
    const { refbase, readsCounted, depth, ref, ...info } = feature.get(
      'snpinfo',
    ) as BaseCoverageBin
    const loc = [
      name,
      start === end ? toLocale(start) : `${toLocale(start)}..${toLocale(end)}`,
    ]
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
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total</td>
              <td>{readsCounted}</td>
              <td> </td>
              <td> </td>
            </tr>
            <tr>
              <td>REF {refbase ? `(${refbase.toUpperCase()})` : ''}</td>
              <td>{ref.entryDepth}</td>
              <td>{pct(ref.entryDepth, readsCounted)}</td>
              <td>
                {ref['-1'] ? `${ref['-1']}(-)` : ''}
                {ref['1'] ? `${ref['1']}(+)` : ''}
              </td>
            </tr>

            {Object.entries(info).map(([key, entry]) =>
              Object.entries(entry).map(([base, score]) => (
                <tr key={base}>
                  <td>{base.toUpperCase()}</td>
                  <td className={classes.td}>
                    {[
                      score.entryDepth,
                      score.avgProbability !== undefined
                        ? `(avg. ${pct(score.avgProbability)} prob.)`
                        : '',
                    ]
                      .filter(f => !!f)
                      .join(' ')}
                  </td>

                  <td>
                    {base === 'depth' || base === 'skip'
                      ? '---'
                      : pct(score.entryDepth, readsCounted)}
                  </td>
                  <td>
                    {score['-1'] ? `${score['-1']}(-)` : ''}
                    {score['1'] ? `${score['1']}(+)` : ''}
                  </td>
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

const SNPCoverageTooltip = observer(function (props: {
  model: {
    featureUnderMouse?: Feature
  }
  height: number
  offsetMouseCoord: Coord
  clientMouseCoord: Coord
  clientRect?: DOMRect
}) {
  const { model } = props
  const { featureUnderMouse: feat } = model
  return feat && feat.get('type') === 'skip' ? null : (
    <Tooltip TooltipContents={TooltipContents} {...props} />
  )
})

export default SNPCoverageTooltip
