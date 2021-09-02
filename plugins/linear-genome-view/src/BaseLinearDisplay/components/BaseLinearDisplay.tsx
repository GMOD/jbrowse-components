import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { alpha, useTheme, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useRef } from 'react'
import LinearBlocks from './LinearBlocks'
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}
const useStyles = makeStyles(theme => ({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
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
const Tooltip = observer(
  ({
    model,
    mouseCoord,
  }: {
    model: BaseLinearDisplayModel
    mouseCoord: [number, number]
  }) => {
    const classes = useStyles()
    const { featureUnderMouse } = model

    return featureUnderMouse ? (
      <div
        className={classes.tooltip}
        style={{
          left: mouseCoord[0] + 25,
          top: mouseCoord[1],
        }}
      >
        {getConf(model, 'mouseover', { feature: featureUnderMouse })}
      </div>
    ) : null
  },
)

type Coord = [number, number]
const BaseLinearDisplay = observer(
  (props: { model: BaseLinearDisplayModel; children?: React.ReactNode }) => {
    const classes = useStyles()
    const theme = useTheme()

    const [mouseCoord, setMouseCoord] = useState<Coord>([0, 0])
    const [contextCoord, setContextCoord] = useState<Coord>()
    const ref = useRef<HTMLDivElement>(null)
    const { model, children } = props
    const {
      TooltipComponent,
      DisplayMessageComponent,
      contextMenuItems,
      height,
      setContextMenuFeature,
    } = model

    return (
      <div
        ref={ref}
        data-testid={`display-${getConf(model, 'displayId')}`}
        className={classes.display}
        onContextMenu={event => {
          event.preventDefault()
          if (contextCoord) {
            // There's already a context menu open, so close it
            setContextCoord(undefined)
          } else if (ref.current) {
            setContextCoord([event.clientX, event.clientY])
          }
        }}
        onMouseMove={event => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setMouseCoord([event.clientX - rect.left, event.clientY - rect.top])
          }
        }}
        role="presentation"
      >
        {DisplayMessageComponent ? (
          <DisplayMessageComponent model={model} />
        ) : (
          <LinearBlocks {...props} />
        )}
        {children}
        <TooltipComponent
          model={model}
          height={height}
          mouseCoord={mouseCoord}
        />

        <Menu
          open={Boolean(contextCoord) && Boolean(contextMenuItems().length)}
          onMenuItemClick={(_, callback) => {
            callback()
            setContextCoord(undefined)
          }}
          onClose={() => {
            setContextCoord(undefined)
            setContextMenuFeature(undefined)
          }}
          TransitionProps={{
            onExit: () => {
              setContextCoord(undefined)
              setContextMenuFeature(undefined)
            },
          }}
          anchorReference="anchorPosition"
          anchorPosition={
            contextCoord
              ? { top: contextCoord[1], left: contextCoord[0] }
              : undefined
          }
          style={{ zIndex: theme.zIndex.tooltip }}
          menuItems={contextMenuItems()}
          data-testid="base_linear_display_context_menu"
        />
      </div>
    )
  },
)

export default BaseLinearDisplay
export { Tooltip }
