import React from 'react'
import { observer } from 'mobx-react'
import { alpha, Portal, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Feature } from '@jbrowse/core/util'
import {
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
// locals
import { YSCALEBAR_LABEL_OFFSET, round } from './util'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { feature: Feature; model: any } & React.RefAttributes<HTMLDivElement>
>

const Tooltip = observer(function Tooltip({
  model,
  height,
  clientMouseCoord,
  offsetMouseCoord,
  clientRect,
  TooltipContents,
  useClientY,
}: {
  model: { featureUnderMouse: Feature }
  useClientY?: boolean
  height: number
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  clientRect?: DOMRect
  TooltipContents: TooltipContentsComponent
}) {
  const theme = useTheme()
  const { featureUnderMouse } = model
  const { classes } = useStyles()
  const { refs, floatingStyles, context } = useFloating({
    placement: 'right',
  })

  const x = clientMouseCoord[0] + 5
  const y = useClientY ? clientMouseCoord[1] : clientRect?.top || 0
  const clientPoint = useClientPoint(context, { x, y })
  const { getFloatingProps } = useInteractions([clientPoint])

  const popperTheme = theme?.components?.MuiPopper

  return featureUnderMouse ? (
    <>
      <Portal container={popperTheme?.defaultProps?.container}>
        <div
          className={classes.tooltip}
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            zIndex: 100000,
            pointerEvents: 'none',
          }}
          {...getFloatingProps()}
        >
          <TooltipContents model={model} feature={featureUnderMouse} />
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
})

export default Tooltip
