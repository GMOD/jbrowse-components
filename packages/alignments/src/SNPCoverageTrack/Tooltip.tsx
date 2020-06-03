/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import Popper from '@material-ui/core/Popper'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

const useStyles = makeStyles({
  popper: {
    fontSize: '0.8em',
    zIndex: 1500, // important to have a zIndex directly on the popper itself, material-ui Tooltip uses popper and has similar thing
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
})
function TooltipContents({ feature }: { feature: Feature }) {
  const info = feature.get('snpinfo')
  const total = info
    ? info[info.map((e: any) => e.base).indexOf('total')].score
    : 0
  const condId = info && info.length >= 5 ? 'smallInfo' : 'info' // readjust table size to fit all
  return (
    <Paper>
      <table>
        <thead>
          <tr>
            <th id={condId}>Base</th>
            <th id={condId}>Count</th>
            <th id={condId}>% of Total</th>
            <th id={condId}>Strands</th>
          </tr>
        </thead>
        <tbody>
          {(info || []).map((mismatch: any) => {
            const { base, score, strands } = mismatch
            return (
              <tr key={base}>
                <td id={condId}>{base.toUpperCase()}</td>
                <td id={condId}>{score}</td>
                <td id={condId}>
                  {base === 'total'
                    ? '---'
                    : `${Math.floor((score / total) * 100)}%`}
                </td>
                <td id={condId}>
                  {base === 'total'
                    ? '---'
                    : (strands['+']
                        ? `+:${strands['+']} ${strands['-'] ? `,\t` : `\t`} `
                        : ``) + (strands['-'] ? `-:${strands['-']}` : ``)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Paper>
  )
}

TooltipContents.propTypes = {
  feature: PropTypes.shape({ get: PropTypes.func.isRequired }).isRequired,
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
    const ref = useRef<HTMLDivElement>(null)

    return (
      <>
        {ref.current && featureUnderMouse ? (
          <>
            <Popper
              placement="right-start"
              className={classes.popper}
              anchorEl={ref.current}
              modifiers={{
                offset: {
                  enabled: true,
                  offset: '0, 10',
                },
              }}
              open
            >
              <TooltipContents feature={featureUnderMouse} />
            </Popper>
            <div
              className={classes.hoverVertical}
              style={{ left: mouseCoord[0], height }}
            />
          </>
        ) : null}

        <div
          ref={ref}
          style={{
            position: 'absolute',
            left: mouseCoord[0],
            top: 0,
          }}
        >
          {' '}
        </div>
      </>
    )
  },
)

export default Tooltip
