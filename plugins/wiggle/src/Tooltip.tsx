import React, { useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import { alpha, Portal } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Feature } from '@jbrowse/core/util'

// locals
import { YSCALEBAR_LABEL_OFFSET, round } from './util'
import { usePopper } from 'react-popper'

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

type Coord = [number, number]

// React.forwardRef component for the tooltip, the ref is used for measuring
// the size of the tooltip
export type TooltipContentsComponent = React.ForwardRefExoticComponent<
  { feature: Feature } & React.RefAttributes<HTMLDivElement>
>

function Tooltip({
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
  TooltipContents: TooltipContentsComponent
}) {
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
            ref={elt => setWidth(elt?.getBoundingClientRect().width || 0)}
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
}

export default observer(Tooltip)
