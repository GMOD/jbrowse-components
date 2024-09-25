import React, { useState, useRef, Suspense } from 'react'
import { observer } from 'mobx-react'
import { useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'

// locals

import LinearBlocks from './LinearBlocks'
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'
import { clamp, getContainingView, measureText } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '../../LinearGenomeView'

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

const FloatingLabels = observer(function ({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { bpPerPx, offsetPx } = view
  return (
    <div style={{ position: 'relative' }}>
      {[...model.layoutFeatures.entries()].map(([key, val]) => {
        return val ? (
          <div
            key={key}
            style={{
              position: 'absolute',
              fontSize: 10,
              left: clamp(
                0,
                val[0] / bpPerPx - offsetPx,
                val[2] / bpPerPx - offsetPx - measureText(val[4].label),
              ),
              top: val[3] - 14,
            }}
          >
            {val[4].label}
          </div>
        ) : null
      })}
    </div>
  )
})

const BaseLinearDisplay = observer(function (props: {
  model: BaseLinearDisplayModel
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const ref = useRef<HTMLDivElement>(null)
  const [clientRect, setClientRect] = useState<DOMRect>()
  const [offsetMouseCoord, setOffsetMouseCoord] = useState<Coord>([0, 0])
  const [clientMouseCoord, setClientMouseCoord] = useState<Coord>([0, 0])
  const [contextCoord, setContextCoord] = useState<Coord>()
  const { model, children } = props
  const { TooltipComponent, DisplayMessageComponent, height } = model
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
      <FloatingLabels model={model} />

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
      {contextCoord ? (
        <MenuPage
          contextCoord={contextCoord}
          model={model}
          onClose={() => setContextCoord(undefined)}
        />
      ) : null}
    </div>
  )
})

function MenuPage({
  onClose,
  contextCoord,
  model,
}: {
  model: BaseLinearDisplayModel
  contextCoord: Coord
  onClose: () => void
}) {
  const items = model.contextMenuItems()
  const theme = useTheme()
  return (
    <Menu
      open={items.length > 0}
      onMenuItemClick={(_, callback) => {
        callback()
        onClose()
      }}
      onClose={() => {
        onClose()
        model.setContextMenuFeature(undefined)
      }}
      TransitionProps={{
        onExit: () => {
          onClose()
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
  )
}

export default BaseLinearDisplay

export { default as Tooltip } from './Tooltip'
export { default as BlockMsg } from './BlockMsg'
