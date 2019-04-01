import React, { Fragment } from 'react'
import { withStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import { getScale, bumpDomain } from '../../WiggleRenderer/util'

const styles = (/* theme */) => ({
  majorTickLabel: {
    fontSize: '11px',
  },
  majorTick: {
    stroke: '#555',
  },
  minorTick: {
    stroke: '#999',
  },
  refSeqLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  refSeqLabelBackground: {
    fontSize: '16px',
    fontWeight: 'bold',
    fill: 'white',
    fillOpacity: 0.75,
    filter: 'url(#dilate)',
  },
})

function pickN(a, n) {
  const p = Math.floor(a.length / n) || 1
  return a.slice(0, p * n).filter((_, i) => i % p === 0)
}

function YScaleBar(props) {
  const {
    statsMin,
    statsMax,
    classes,
    minScore,
    maxScore,
    inverted,
    scaleType,
    height,
  } = props
  let [min, max] = bumpDomain([statsMin, statsMax], scaleType)
  if (minScore !== -Infinity) min = minScore
  if (maxScore !== Infinity) max = maxScore
  const scale = getScale(scaleType, [min, max], [0, height], { inverted })
  return (
    <svg height={height}>
      <line
        x1={100}
        x2={100}
        y1={0}
        y2={height}
        strokeWidth={1}
        stroke="#555"
        className={classes.majorTick}
      />
      {pickN(scale.ticks(3), 5).map(i => (
        <Fragment key={`frag-${i}`}>
          <line
            x1={100}
            x2={105}
            key={`tick-${i}`}
            y1={height - scale(i)}
            y2={height - scale(i)}
            strokeWidth={1}
            stroke="#555"
            className={classes.majorTick}
          />
          <text
            x={105}
            y={height - scale(i)}
            key={`label-${i}`}
            dominantBaseline="middle"
            style={{ fontSize: '11px' }}
            className={classes.majorTickLabel}
          >
            {Number(i).toLocaleString()}
          </text>
        </Fragment>
      ))}
    </svg>
  )
}

YScaleBar.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  statsMin: ReactPropTypes.number.isRequired,
  statsMax: ReactPropTypes.number.isRequired,
  height: ReactPropTypes.number.isRequired,
  minScore: ReactPropTypes.number,
  maxScore: ReactPropTypes.number,
  inverted: ReactPropTypes.bool,
  scaleType: ReactPropTypes.string,
  model: ReactPropTypes.shape({}),
}
YScaleBar.defaultProps = {
  model: {},
  inverted: false,
  scaleType: 'linear',
  minScore: -Infinity,
  maxScore: Infinity,
}

export default withStyles(styles)(YScaleBar)
