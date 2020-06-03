import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import Popper from '@material-ui/core/Popper'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'

const toP = s => parseFloat(s.toPrecision(6))
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
  },
})
function TooltipContents(props) {
  const { feature } = props
  return (
    <Paper>
      {feature.get('summary') !== undefined ? (
        <div>
          Summary
          <br />
          Max: {toP(feature.get('maxScore'))}
          <br />
          Avg: {toP(feature.get('score'))}
          <br />
          Min: {toP(feature.get('minScore'))}
        </div>
      ) : (
        toP(feature.get('score'))
      )}
    </Paper>
  )
}

TooltipContents.propTypes = {
  feature: PropTypes.shape({ get: PropTypes.func.isRequired }).isRequired,
}

const Tooltip = observer(props => {
  const { model, height, mouseCoord } = props
  const { featureUnderMouse } = model
  const classes = useStyles()
  const ref = useRef()
  return (
    <>
      {ref.current && featureUnderMouse ? (
        <Popper
          placement="right-start"
          className={classes.popper}
          anchorEl={ref.current}
          open
        >
          <TooltipContents
            feature={featureUnderMouse}
            offsetX={mouseCoord[0]}
          />
        </Popper>
      ) : null}
      <div
        className={classes.hoverVertical}
        style={{ left: mouseCoord[0], height }}
      />
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
})

export default Tooltip
