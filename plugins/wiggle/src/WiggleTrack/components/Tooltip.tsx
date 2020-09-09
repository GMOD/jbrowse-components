/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import MUITooltip from '@material-ui/core/Tooltip'
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
  return feature.get('summary') !== undefined ? (
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
    <div>{toP(feature.get('score'))}</div>
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
