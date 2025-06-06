import { forwardRef } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

import type { BaseCoverageBin } from '../../shared/types'
import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()(() => ({
  td: {
    whiteSpace: 'nowrap',
  },
}))

const toP = (s = 0) => +(+s).toFixed(1)

const pct = (n: number, total = 1) => `${toP((n / (total || 1)) * 100)}%`

interface Props {
  feature: Feature
  model: {
    visibleModifications: Map<string, { color: string }>
  }
}

function ColorSquare({
  base,
  model,
}: {
  base: string
  model: { visibleModifications: Map<string, { color: string }> }
}) {
  const { visibleModifications } = model
  return base.startsWith('mod_') ? (
    <div
      style={{
        width: 10,
        height: 10,
        background: visibleModifications.get(base.replace('mod_', ''))?.color,
      }}
    />
  ) : null
}

const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2(props, reactRef) {
    const { feature, model } = props
    const { classes } = useStyles()
    const start = feature.get('start') + 1
    const end = feature.get('end')
    const name = feature.get('refName')
    const { refbase, readsCounted, depth, ref, ...info } = feature.get(
      'snpinfo',
    ) as BaseCoverageBin

    return (
      <div ref={reactRef}>
        <table>
          <caption>
            {[
              name,
              start === end
                ? toLocale(start)
                : `${toLocale(start)}..${toLocale(end)}`,
            ]
              .filter(f => !!f)
              .join(':')}
          </caption>
          <thead>
            <tr>
              <th />
              <th>Base</th>
              <th>Count</th>
              <th>% of Total</th>
              <th>Strands</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td />
              <td>Total</td>
              <td>{readsCounted}</td>
              <td> </td>
              <td> </td>
            </tr>
            <tr>
              <td />
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
                <tr key={`${key}_${base}`}>
                  <td>
                    <ColorSquare model={model} base={base} />
                  </td>
                  <td>{base.toUpperCase()} </td>
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

export default TooltipContents
