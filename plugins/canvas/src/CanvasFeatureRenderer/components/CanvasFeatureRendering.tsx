import { useCallback, useEffect, useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { bpToPx, measureText } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import { observer } from 'mobx-react'

import FeatureGlyph from './FeatureGlyph'
import CanvasOverlay from './CanvasOverlay'
import { chooseGlyphComponent, layOut } from './util'

import type { DisplayModel, ExtraGlyphValidator } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import { PrerenderedCanvas } from '@jbrowse/core/ui'

// used to make features have a little padding for their labels
const xPadding = 3
const yPadding = 5

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const canvasHeightPadding = 100

const CanvasFeatureRendering = observer(function CanvasFeatureRendering(props: {
  layout: BaseLayout<unknown>
  blockKey: string
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  colorByCDS: boolean
  features: Map<string, Feature>
  displayModel?: DisplayModel
  width: number
  height: number
  exportSVG?: boolean
  viewParams: {
    start: number
    end: number
    offsetPx: number
    offsetPx1: number
  }
  featureDisplayHandler?: (f: Feature) => boolean
  onMouseOut?: React.MouseEventHandler
  onMouseDown?: React.MouseEventHandler
  onMouseLeave?: React.MouseEventHandler
  onMouseEnter?: React.MouseEventHandler
  onMouseOver?: React.MouseEventHandler
  onMouseMove?: (event: React.MouseEvent, featureId?: string) => void
  onMouseUp?: React.MouseEventHandler
  onClick?: React.MouseEventHandler
}) {
  const {
    layout,
    blockKey,
    regions = [],
    bpPerPx,
    config,
    displayModel = {},
    featureDisplayHandler,
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onClick,
  } = props

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const displayMode = readConfObject(config, 'displayMode') as string
  const maxConfHeight = readConfObject(config, 'maxHeight') as number

  const ref = useRef<HTMLCanvasElement>(null)
  // const [mouseIsDown, setMouseIsDown] = useState(false)
  // const [height, setHeight] = useState(maxConfHeight)
  // const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
  //   useState(false)
  // const [initialMousePos, setInitialMousePos] = useState<{
  //   x: number
  //   y: number
  // }>()
  //
  // const mouseDown = useCallback(
  //   (event: React.MouseEvent) => {
  //     setMouseIsDown(true)
  //     setMovedDuringLastMouseDown(false)
  //     setInitialMousePos({
  //       x: event.clientX,
  //       y: event.clientY,
  //     })
  //     return onMouseDown?.(event)
  //   },
  //   [onMouseDown],
  // )
  //
  // const mouseUp = useCallback(
  //   (event: React.MouseEvent) => {
  //     setMouseIsDown(false)
  //     setInitialMousePos(undefined)
  //     return onMouseUp?.(event)
  //   },
  //   [onMouseUp],
  // )
  //
  // const mouseMove = useCallback(
  //   (event: React.MouseEvent) => {
  //     if (!ref.current) {
  //       return
  //     }
  //     if (mouseIsDown && initialMousePos) {
  //       const dx = event.clientX - initialMousePos.x
  //       const dy = event.clientY - initialMousePos.y
  //       if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
  //         setMovedDuringLastMouseDown(true)
  //       }
  //     }
  //     const { left, top } = ref.current.getBoundingClientRect()
  //     const offsetX = event.clientX - left
  //     const offsetY = event.clientY - top
  //     const px = region.reversed ? width - offsetX : offsetX
  //     const clientBp = region.start + bpPerPx * px
  //
  //     const featureIdCurrentlyUnderMouse = displayModel.getFeatureOverlapping?.(
  //       blockKey,
  //       clientBp,
  //       offsetY,
  //     )
  //
  //     if (onMouseMove) {
  //       onMouseMove(event, featureIdCurrentlyUnderMouse)
  //     }
  //   },
  //   [
  //     initialMousePos,
  //     blockKey,
  //     bpPerPx,
  //     mouseIsDown,
  //     onMouseMove,
  //     region.reversed,
  //     region.start,
  //     displayModel,
  //     width,
  //   ],
  // )
  //
  // const click = useCallback(
  //   (event: React.MouseEvent) => {
  //     // don't select a feature if we are clicking and dragging
  //     if (movedDuringLastMouseDown) {
  //       return
  //     }
  //     onClick?.(event)
  //   },
  //   [movedDuringLastMouseDown, onClick],
  // )

  // Get the canvas context and draw features
  // useEffect(() => {
  //   const canvas = ref.current
  //   if (canvas) {
  //     const ctx = canvas.getContext('2d')
  //     if (ctx) {
  //       ctx.clearRect(0, 0, canvas.width, canvas.height)
  //       RenderedFeatures({
  //         displayMode,
  //         region,
  //         movedDuringLastMouseDown,
  //         isFeatureDisplayed: featureDisplayHandler,
  //         ctx,
  //         ...props,
  //       })
  //       // Pass the context to RenderedFeatures and CanvasOverlay
  //       // This will trigger re-renders of those components, which will then draw on the canvas
  //       // The actual drawing logic is within RenderedFeatures and CanvasOverlay
  //     }
  //   }
  // }, [height, width, props]) // Re-draw when height, width, or props change
  console.log({ props })

  return <PrerenderedCanvas {...props} />
})

export default CanvasFeatureRendering
