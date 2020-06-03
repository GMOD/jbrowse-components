/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import Popper from '@material-ui/core/Popper'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

const toP = (s: number) => parseFloat(s.toPrecision(6))

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

function TooltipContents(props: { feature: Feature }) {
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
