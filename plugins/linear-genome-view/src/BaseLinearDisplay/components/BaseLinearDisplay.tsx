import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { useTheme, makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useState, useRef } from 'react'
import MUITooltip from '@material-ui/core/Tooltip'
import LinearBlocks from './LinearBlocks'
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

const useStyles = makeStyles({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})
const Tooltip = observer(
  (props: { model: BaseLinearDisplayModel; mouseCoord: [number, number] }) => {
    const { model, mouseCoord } = props
    const { featureUnderMouse } = model
    const mouseover = featureUnderMouse
      ? getConf(model, 'mouseover', { feature: featureUnderMouse })
      : undefined
    return mouseover ? (
      <MUITooltip title={mouseover} open placement="right">
        <div
          style={{
            position: 'absolute',
            left: mouseCoord[0],
            top: mouseCoord[1],
          }}
        >
          {' '}
        </div>
      </MUITooltip>
    ) : null
  },
)

type Coord = [number, number]
const BaseLinearDisplay = observer(
  (props: { model: BaseLinearDisplayModel; children?: React.ReactNode }) => {
    const classes = useStyles()
    const theme = useTheme()
    const ref = useRef<HTMLDivElement>(null)
    const [clientRect, setClientRect] = useState<ClientRect>()
    const [offsetMouseCoord, setOffsetMouseCoord] = useState<Coord>([0, 0])
    const [clientMouseCoord, setClientMouseCoord] = useState<Coord>([0, 0])
    const [contextCoord, setContextCoord] = useState<Coord>()
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
            setOffsetMouseCoord([
              event.clientX - rect.left,
              event.clientY - rect.top,
            ])
            setClientMouseCoord([event.clientX, event.clientY])
            setClientRect(rect)
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
          offsetMouseCoord={offsetMouseCoord}
          clientMouseCoord={clientMouseCoord}
          clientRect={clientRect}
          mouseCoord={offsetMouseCoord}
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
