/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles, alpha, Portal } from '@material-ui/core'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { YSCALEBAR_LABEL_OFFSET } from '../models/model'
import { usePopper } from 'react-popper'

function toP(s = 0) {
  return parseFloat(s.toPrecision(6))
}

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const useStyles = makeStyles(theme => ({
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
    clientMouseCoord,
    offsetMouseCoord,
    clientRect,
    TooltipContents,
  }: {
    model: any
    height: number
    clientMouseCoord: Coord
    offsetMouseCoord: Coord
    clientRect?: ClientRect
    TooltipContents: React.FC<any>
  }) => {
    const { featureUnderMouse } = model
    const classes = useStyles()

    const [popperElement, setPopperElement] = useState<any>(null)

    const virtElement = useMemo(
      () => ({
        getBoundingClientRect: () => {
          return {
            top: clientRect?.top || 0,
            left: clientMouseCoord[0] + 20,
            bottom: clientRect?.top || 0,
            right: clientMouseCoord[0],
            width: 0,
            height: 0,
          }
        },
      }),
      [clientRect?.top, clientMouseCoord],
    )
    const { styles, attributes } = usePopper(virtElement, popperElement)

    return featureUnderMouse ? (
      <>
        <Portal>
          <div
            ref={setPopperElement}
            className={classes.tooltip}
            // zIndex needed to go over widget drawer
            style={{ ...styles.popper, zIndex: 100000 }}
            {...attributes.popper}
          >
            <TooltipContents feature={featureUnderMouse} />
          </div>
        </Portal>

        <div
          className={classes.hoverVertical}
          style={{
            left: offsetMouseCoord[0],
            height: height - YSCALEBAR_LABEL_OFFSET * 2,
          }}
        />
      </>
    ) : null
  },
)

const WiggleTooltip = observer(
  (props: {
    model: any
    height: number
    offsetMouseCoord: Coord
    clientMouseCoord: Coord
    clientRect?: ClientRect
  }) => {
    return <Tooltip TooltipContents={TooltipContents} {...props} />
  },
)
export default WiggleTooltip
export { Tooltip }
