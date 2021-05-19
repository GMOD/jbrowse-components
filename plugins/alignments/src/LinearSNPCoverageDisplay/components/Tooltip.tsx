/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import MUITooltip from '@material-ui/core/Tooltip'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { Feature } from '@jbrowse/core/util/simpleFeature'

const useStyles = makeStyles(theme => ({
  popper: {
    fontSize: '0.8em',
    zIndex: theme.zIndex.tooltip, // important to have a zIndex directly on the popper itself, material-ui Tooltip uses popper and has similar thing
    pointerEvents: 'none', // needed to avoid rapid mouseLeave/mouseEnter on popper
  },

  hoverVertical: {
    background: '#333',
    border: 'none',
    width: 1,
    height: '100%',
    top: 0,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
}))

type Count = {
  [key: string]: {
    total: number
    strands: { [key: string]: number }
  }
}

function TooltipContents({ feature }: { feature: Feature }) {
  const refName = feature.get('refName')
  const start = (feature.get('start') + 1).toLocaleString('en-US')
  const end = feature.get('end').toLocaleString('en-US')
  const loc = `${refName ? `${refName}:` : ''}${
    start === end ? start : `${start}..${end}`
  }`

  const info = feature.get('snpinfo') as {
    ref: Count
    cov: Count
    lowqual: Count
    noncov: Count
    delskips: Count
    total: number
  }

  const { total, ref, cov, noncov, lowqual, delskips } = info
  return (
    <div>
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
            <td />
          </tr>

          {Object.entries({ ref, cov, noncov, delskips, lowqual }).map(
            ([key, entry]) => {
              return (
                <React.Fragment key={key}>
                  {Object.entries(entry).map(([base, score]) => {
                    const { strands } = score
                    return (
                      <tr key={base}>
                        <td>{base.toUpperCase()}</td>
                        <td>{score.total}</td>
                        <td>
                          {base === 'total'
                            ? '---'
                            : `${Math.floor((score.total / total) * 100)}%`}
                        </td>
                        <td>
                          {strands['-1'] ? `${strands['-1']}(-)` : ''}
                          {strands['1'] ? `${strands['1']}(+)` : ''}
                        </td>
                        <td>{key}</td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              )
            },
          )}
        </tbody>
      </table>
    </div>
  )
}

type Coord = [number, number]
const Tooltip = observer(
  ({
    model,
    height,
    mouseCoord,
  }: {
    model: any
    height: number
    mouseCoord: Coord
  }) => {
    const { featureUnderMouse } = model
    const classes = useStyles()

    return featureUnderMouse ? (
      <>
        <MUITooltip
          placement="right-start"
          className={classes.popper}
          open
          title={<TooltipContents feature={featureUnderMouse} />}
        >
          <div
            style={{
              position: 'absolute',
              left: mouseCoord[0],
              top: 0,
            }}
          >
            {' '}
          </div>
        </MUITooltip>
        <div
          className={classes.hoverVertical}
          style={{ left: mouseCoord[0], height }}
        />
      </>
    ) : null
  },
)

export default Tooltip
