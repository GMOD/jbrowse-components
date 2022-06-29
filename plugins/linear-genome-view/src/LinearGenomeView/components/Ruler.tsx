import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import { makeTicks } from '../util'
import { getTickDisplayStr } from '@jbrowse/core/util'

const useStyles = makeStyles()((/* theme */) => ({
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
  reversed,
  major,
  minor,
}: {
  start: number
  end: number
  bpPerPx: number
  reversed?: boolean
  major: boolean
  minor: boolean
}) {
  const { classes } = useStyles()
  const ticks = makeTicks(start, end, bpPerPx, major, minor)
  return (
    <>
      {ticks.map(tick => {
        const x = (reversed ? end - tick.base : tick.base - start) / bpPerPx
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
          const x = (reversed ? end - tick.base : tick.base - start) / bpPerPx
          return (
            <text
              x={x - 3}
              y={7 + 11}
              key={`label-${tick.base}`}
              style={{ fontSize: '11px' }}
              className={classes.majorTickLabel}
            >
              {getTickDisplayStr(tick.base + 1, bpPerPx)}
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
  reversed: ReactPropTypes.bool,
  major: ReactPropTypes.bool,
  minor: ReactPropTypes.bool,
}

Ruler.defaultProps = {
  reversed: false,
  major: true,
  minor: true,
}

export default observer(Ruler)
