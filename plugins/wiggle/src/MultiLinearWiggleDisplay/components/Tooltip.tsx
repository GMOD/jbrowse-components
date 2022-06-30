import React, { useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import { alpha, Portal } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Feature } from '@jbrowse/core/util/simpleFeature'

// locals
import { YSCALEBAR_LABEL_OFFSET } from '../../util'
import { usePopper } from 'react-popper'

// convert to number, apply shortened precision, and render
function toP(s = 0) {
  return +(+s).toPrecision(6)
}

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const en = (n: number) => n.toLocaleString('en-US')

const useStyles = makeStyles()(theme => ({
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
    fontSize: theme.typography.pxToRem(12),
    lineHeight: `${round(14 / 10)}em`,
    maxWidth: 300,
    wordWrap: 'break-word',
  },

  hoverVertical: {
    background: '#333',
    border: 'none',
    width: 1,
    height: '100%',
    top: YSCALEBAR_LABEL_OFFSET,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
}))

const TooltipContents = React.forwardRef<HTMLDivElement, { feature: Feature }>(
  ({ feature }: { feature: Feature }, ref) => {
    const start = feature.get('start')
    const end = feature.get('end')
    const name = feature.get('refName')
    const loc = [name, start === end ? en(start) : `${en(start)}..${en(end)}`]
      .filter(f => !!f)
      .join(':')

    return feature.get('summary') !== undefined ? (
      <div ref={ref}>
        {loc}
        <br />
        Max: {toP(feature.get('maxScore'))}
        <br />
        Avg: {toP(feature.get('score'))}
        <br />
        Min: {toP(feature.get('minScore'))}
      </div>
    ) : (
      <div ref={ref}>
        {loc}
        <br />
        {`${toP(feature.get('score'))}`}
      </div>
    )
  },
)

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
    model: { featureUnderMouse: Feature }
    height: number
    clientMouseCoord: Coord
    offsetMouseCoord: Coord
    clientRect?: DOMRect

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TooltipContents: React.FC<any>
  }) => {
    const { featureUnderMouse } = model
    const [width, setWidth] = useState(0)
    const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
    const { classes } = useStyles()

    // must be memoized a la https://github.com/popperjs/react-popper/issues/391
    const virtElement = useMemo(
      () => ({
        getBoundingClientRect: () => {
          const x = clientMouseCoord[0] + width / 2 + 20
          const y = clientRect?.top || 0
          return {
            top: y,
            left: x,
            bottom: y,
            right: x,
            width: 0,
            height: 0,
            x,
            y,
            toJSON() {},
          }
        },
      }),
      [clientRect?.top, clientMouseCoord, width],
    )
    const { styles, attributes } = usePopper(virtElement, anchorEl)

    return featureUnderMouse ? (
      <>
        <Portal>
          <div
            ref={setAnchorEl}
            className={classes.tooltip}
            // zIndex needed to go over widget drawer
            style={{ ...styles.popper, zIndex: 100000 }}
            {...attributes.popper}
          >
            <TooltipContents
              ref={(elt: HTMLDivElement) => {
                setWidth(elt?.getBoundingClientRect().width || 0)
              }}
              feature={featureUnderMouse}
            />
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
    model: { featureUnderMouse: Feature }
    height: number
    offsetMouseCoord: Coord
    clientMouseCoord: Coord
    clientRect?: DOMRect
  }) => {
    return <Tooltip TooltipContents={TooltipContents} {...props} />
  },
)
export default WiggleTooltip
export { Tooltip }
