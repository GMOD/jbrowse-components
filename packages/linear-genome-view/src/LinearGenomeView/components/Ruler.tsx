import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import { makeTicks } from '../util'

function mathPower(num: number): string {
  if (num < 999) {
    return String(num)
  }
  // eslint-disable-next-line no-bitwise
  return `${mathPower(~~(num / 1000))},${`00${~~(num % 1000)}`.substr(-3, 3)}`
}

const useStyles = makeStyles((/* theme */) => ({
  majorTickLabel: {
    fontSize: '11px',
    // fill: theme.palette.text.primary,
  },
  majorTick: {
    stroke: '#555',
    // stroke: theme.palette.text.secondary,
  },
  minorTick: {
    stroke: '#999',
    // stroke: theme.palette.text.hint,
  },
}))

function Ruler({
  start,
  end,
  bpPerPx,
  flipped,
  major,
  minor,
}: {
  start: number
  end: number
  bpPerPx: number
  flipped: boolean
  major: boolean
  minor: boolean
}) {
  const classes = useStyles()
  const ticks = makeTicks(start, end, bpPerPx, major, minor)
  return (
    <>
      {ticks.map(tick => {
        const x = (flipped ? end - tick.base : tick.base - start) / bpPerPx
        return (
          <line
            key={tick.base}
            x1={x}
            x2={x}
            y1={0}
            y2={tick.type === 'major' ? 6 : 4}
            strokeWidth={1}
            stroke={tick.type === 'major' ? '#555' : '#999'}
            className={
              tick.type === 'major' ? classes.majorTick : classes.minorTick
            }
            data-bp={tick.base}
          />
        )
      })}
      {ticks
        .filter(tick => tick.type === 'major')
        .map(tick => {
          const x = (flipped ? end - tick.base : tick.base - start) / bpPerPx
          return (
            <text
              x={x - 3}
              y={7}
              key={`label-${tick.base}`}
              dominantBaseline="hanging"
              style={{ fontSize: '11px' }}
              className={classes.majorTickLabel}
            >
              {mathPower(tick.base + 1)}
            </text>
          )
        })}
    </>
  )
}

Ruler.propTypes = {
  start: ReactPropTypes.number.isRequired,
  end: ReactPropTypes.number.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  flipped: ReactPropTypes.bool,
  major: ReactPropTypes.bool,
  minor: ReactPropTypes.bool,
}

Ruler.defaultProps = {
  flipped: false,
  major: true,
  minor: true,
}

export default observer(Ruler)
