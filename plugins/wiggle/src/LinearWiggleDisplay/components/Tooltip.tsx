/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { observer } from 'mobx-react'
import { alpha, makeStyles } from '@material-ui/core'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { YSCALEBAR_LABEL_OFFSET } from '../models/model'

const toP = (s = 0) => parseFloat(s.toPrecision(6))

const en = (n: number) => n.toLocaleString('en-US')

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const useStyles = makeStyles(theme => ({
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
    zIndex: 10000,
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

function TooltipContents({ feature }: { feature: Feature }) {
  const start = feature.get('start')
  const end = feature.get('end')
  const ref = feature.get('refName')
  const loc = [ref, start === end ? en(start) : `${en(start)}..${en(end)}`]
    .filter(f => !!f)
    .join(':')

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

const Tooltip = observer(
  ({
    model,
    height,
    mouseCoord,
    TooltipContents,
  }: {
    model: any
    height: number
    mouseCoord: [number, number]
    TooltipContents: React.FC<any>
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

const WiggleTooltip = observer(
  (props: { model: any; height: number; mouseCoord: [number, number] }) => {
    return <Tooltip TooltipContents={TooltipContents} {...props} />
  },
)
export default WiggleTooltip
export { Tooltip }
