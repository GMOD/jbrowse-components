import { Suspense, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import FloatingLegend from './FloatingLegend.tsx'
import LinearBlocks from './LinearBlocks.tsx'
import MenuPage from './MenuPage.tsx'

import type { Coord } from './types.ts'
import type { BaseLinearDisplayModel } from '../model.ts'

const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

const BaseLinearDisplay = observer(function BaseLinearDisplay(props: {
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
  const {
    TooltipComponent,
    DisplayMessageComponent,
    height,
    showLegend,
    showTooltipsEnabled,
  } = model
  const theme = useTheme()
  const legendItems =
    'legendItems' in model && typeof model.legendItems === 'function'
      ? model.legendItems(theme)
      : []
  return (
    <div
      ref={ref}
      data-testid={`display-${model.configuration.displayId}`}
      className={classes.display}
      onContextMenu={
        DisplayMessageComponent
          ? undefined
          : event => {
              event.preventDefault()
              if (contextCoord) {
                setContextCoord(undefined)
              } else if (ref.current) {
                setContextCoord([event.clientX, event.clientY])
              }
            }
      }
      onMouseMove={
        DisplayMessageComponent
          ? undefined
          : event => {
              if (!ref.current) {
                return
              }
              const rect = ref.current.getBoundingClientRect()
              const { left, top } = rect
              setOffsetMouseCoord([event.clientX - left, event.clientY - top])
              setClientMouseCoord([event.clientX, event.clientY])
              setClientRect(rect)
            }
      }
    >
      {DisplayMessageComponent ? (
        <DisplayMessageComponent model={model} />
      ) : (
        <LinearBlocks {...props} />
      )}
      {children}

      {showLegend && legendItems.length > 0 ? (
        <FloatingLegend items={legendItems} />
      ) : null}

      {showTooltipsEnabled ? (
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
      ) : null}
      {contextCoord && !DisplayMessageComponent ? (
        <MenuPage
          contextCoord={contextCoord}
          model={model}
          onClose={() => {
            setContextCoord(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default BaseLinearDisplay

export { default as Tooltip } from './Tooltip.tsx'
export { default as BlockMsg } from './BlockMsg.tsx'
