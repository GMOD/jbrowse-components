import React, { useState, useMemo } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { Portal, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { usePopper } from 'react-popper'

// locals
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}
const useStyles = makeStyles()(theme => ({
  // these styles come from
  // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tooltip/Tooltip.js
  tooltip: {
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
}))

const TooltipContents = React.forwardRef<
  HTMLDivElement,
  { message: React.ReactNode | string }
>(({ message }: { message: React.ReactNode | string }, ref) => {
  return <div ref={ref}>{message}</div>
})

type Coord = [number, number]
const Tooltip = observer(
  ({
    model,
    clientMouseCoord,
  }: {
    model: BaseLinearDisplayModel
    clientMouseCoord: Coord
  }) => {
    const { classes } = useStyles()
    const { featureUnderMouse } = model
    const [width, setWidth] = useState(0)
    const [popperElt, setPopperElt] = useState<HTMLDivElement | null>(null)

    // must be memoized a la https://github.com/popperjs/react-popper/issues/391
    const virtElement = useMemo(
      () => ({
        getBoundingClientRect: () => {
          const x = clientMouseCoord[0] + width / 2 + 20
          const y = clientMouseCoord[1]
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
      [clientMouseCoord, width],
    )
    const { styles, attributes } = usePopper(virtElement, popperElt)

    const contents = featureUnderMouse
      ? getConf(model, 'mouseover', { feature: featureUnderMouse })
      : undefined

    return featureUnderMouse && contents ? (
      <Portal>
        <div
          ref={setPopperElt}
          className={classes.tooltip}
          // zIndex needed to go over widget drawer
          style={{ ...styles.popper, zIndex: 100000 }}
          {...attributes.popper}
        >
          <TooltipContents
            ref={elt => setWidth(elt?.getBoundingClientRect().width || 0)}
            message={contents}
          />
        </div>
      </Portal>
    ) : null
  },
)

export default Tooltip
