import React, { Fragment } from 'react'
import { withStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import { getScale } from '../../WiggleRenderer/util'
import { readConfObject } from '../../../configuration'

const styles = (/* theme */) => ({
  majorTickLabel: {
    fontSize: '11px',
    // fill: theme.palette.text.primary,
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
  const { min, max, classes, model, scaleType } = props
  const { height, configuration } = model
  const inverted = readConfObject(configuration.renderer, 'inverted')
  const scale = getScale(scaleType, [min, max], [0, height], { inverted })
  return (
    <>
      <line
        x1={100}
        x2={100}
        y1={0}
        y2={100}
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
    </>
  )
}

YScaleBar.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  min: ReactPropTypes.number.isRequired,
  max: ReactPropTypes.number.isRequired,
}

export default withStyles(styles)(YScaleBar)
