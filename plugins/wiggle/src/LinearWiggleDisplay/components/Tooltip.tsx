/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { observer } from 'mobx-react'
import { alpha, makeStyles } from '@material-ui/core'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { YSCALEBAR_LABEL_OFFSET } from '../models/model'

const toP = (s = 0) => parseFloat(s.toPrecision(6))

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}
const useStyles = makeStyles(theme => ({
  popper: {
    fontSize: '0.8em',

    // important to have a zIndex directly on the popper itself
    // @material-ui/Tooltip uses popper and has similar thing
    zIndex: theme.zIndex.tooltip,

    // needed to avoid rapid mouseLeave/mouseEnter on popper
    pointerEvents: 'none',
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

  // these styles come from
  // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tooltip/Tooltip.js
  tooltip: {
    position: 'absolute',
    pointerEvents: 'none',
    backgroundColor: alpha(theme.palette.grey[700], 0.9),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.common.white,
    fontFamily: theme.typography.fontFamily,
    padding: '4px 8px',
    fontSize: theme.typography.pxToRem(10),
    lineHeight: `${round(14 / 10)}em`,
    maxWidth: 300,
    wordWrap: 'break-word',
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

function TooltipContents(props: { feature: Feature }) {
  const { feature } = props
  const ref = feature.get('refName')
  const displayRef = `${ref ? `${ref}:` : ''}`
  const start = (feature.get('start') + 1).toLocaleString('en-US')
  const end = feature.get('end').toLocaleString('en-US')
  const coord = start === end ? start : `${start}..${end}`
  const loc = `${displayRef}${coord}`

  return feature.get('summary') !== undefined ? (
    <div>
      {loc}
      <br />
      Max: {toP(feature.get('maxScore'))}
      <br />
      Avg: {toP(feature.get('score'))}
      <br />
      Min: {toP(feature.get('minScore'))}
    </div>
  ) : (
    <div>
      {loc}
      <br />
      {`${toP(feature.get('score'))}`}
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
        <div
          className={classes.tooltip}
          style={{
            left: mouseCoord[0] + 25,
            top: 0,
          }}
        >
          <TooltipContents feature={featureUnderMouse} />
        </div>
        <div
          className={classes.hoverVertical}
          style={{
            left: mouseCoord[0],
            height: height - YSCALEBAR_LABEL_OFFSET * 2,
          }}
        />
      </>
    ) : null
  },
)

export default Tooltip
