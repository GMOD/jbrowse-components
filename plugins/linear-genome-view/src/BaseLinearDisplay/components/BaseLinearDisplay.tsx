import React, { useState, useRef, Suspense } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals

import LinearBlocks from './LinearBlocks'
import type { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

type Coord = [number, number]

const BaseLinearDisplay = observer(function (props: {
  model: BaseLinearDisplayModel
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [clientRect, setClientRect] = useState<DOMRect>()
  const [offsetMouseCoord, setOffsetMouseCoord] = useState<Coord>([0, 0])
  const [clientMouseCoord, setClientMouseCoord] = useState<Coord>([0, 0])
  const [contextCoord, setContextCoord] = useState<Coord>()
  const { model, children } = props
  const { TooltipComponent, DisplayMessageComponent, height } = model
  const items = model.contextMenuItems()
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
        if (!ref.current) {
          return
        }
        const rect = ref.current.getBoundingClientRect()
        const { left, top } = rect
        setOffsetMouseCoord([event.clientX - left, event.clientY - top])
        setClientMouseCoord([event.clientX, event.clientY])
        setClientRect(rect)
      }}
    >
      {DisplayMessageComponent ? (
        <DisplayMessageComponent model={model} />
      ) : (
        <LinearBlocks {...props} />
      )}
      {children}

      <Suspense fallback={null}>
        <TooltipComponent
          model={model}
          height={height}
          offsetMouseCoord={offsetMouseCoord}
          clientMouseCoord={clientMouseCoord}
          clientRect={clientRect}
          mouseCoord={offsetMouseCoord}
        />
      </Suspense>

      <Menu
        open={Boolean(contextCoord) && items.length > 0}
        onMenuItemClick={(_, callback) => {
          callback()
          setContextCoord(undefined)
        }}
        onClose={() => {
          setContextCoord(undefined)
          model.setContextMenuFeature(undefined)
        }}
        TransitionProps={{
          onExit: () => {
            setContextCoord(undefined)
            model.setContextMenuFeature(undefined)
          },
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          contextCoord
            ? { top: contextCoord[1], left: contextCoord[0] }
            : undefined
        }
        style={{
          zIndex: theme.zIndex.tooltip,
        }}
        menuItems={items}
      />
    </div>
  )
})

export default BaseLinearDisplay

export { default as Tooltip } from './Tooltip'
export { default as BlockMsg } from './BlockMsg'
