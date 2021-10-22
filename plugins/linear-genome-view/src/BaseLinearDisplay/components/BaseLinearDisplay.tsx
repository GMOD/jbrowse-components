import React, { useState, useRef, useMemo } from 'react'
import { Portal, alpha, useTheme, makeStyles } from '@material-ui/core'
import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { usePopper } from 'react-popper'

// locals
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

const TooltipContents = React.forwardRef<
  HTMLDivElement,
  { message: React.ReactNode | string }
>(({ message }: { message: React.ReactNode | string }, ref) => {
  return <div ref={ref}>{message}</div>
})

const Tooltip = observer(
  ({
    model,
    clientMouseCoord,
  }: {
    model: BaseLinearDisplayModel
    clientMouseCoord: Coord
  }) => {
    const classes = useStyles()
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
            ref={(elt: HTMLDivElement) =>
              setWidth(elt?.getBoundingClientRect().width || 0)
            }
            message={contents}
          />
        </div>
      </Portal>
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
