import { Suspense, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LinearBlocks from './LinearBlocks'
import MenuPage from './MenuPage'

import type { Coord } from './types'
import type { BaseLinearDisplayModel } from '../model'

const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
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
          onClose={() => {
            setContextCoord(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default BaseLinearDisplay

export { default as Tooltip } from './Tooltip'
export { default as BlockMsg } from './BlockMsg'
