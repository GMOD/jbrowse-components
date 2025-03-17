import { useCallback, useEffect, useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import RenderedFeatures from './RenderedFeatures'
import SvgOverlay from './SvgOverlay'

import type { DisplayModel, ExtraGlyphValidator, ViewParams } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const svgHeightPadding = 100

const SvgFeatureRendering = observer(function SvgFeatureRendering(props: {
  layout: BaseLayout<unknown>
  blockKey: string
  regions: Region[]
  bpPerPx: number
  detectRerender?: () => void
  config: AnyConfigurationModel
  colorByCDS: boolean
  features: Map<string, Feature>
  displayModel?: DisplayModel
  exportSVG?: boolean
  viewParams: ViewParams
  featureDisplayHandler?: (f: Feature) => boolean
  extraGlyphs?: ExtraGlyphValidator[]
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
    exportSVG,
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

  const ref = useRef<SVGSVGElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [height, setHeight] = useState(maxConfHeight)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const [initialMousePos, setInitialMousePos] = useState<{
    x: number
    y: number
  }>()

  const mouseDown = useCallback(
    (event: React.MouseEvent) => {
      setMouseIsDown(true)
      setMovedDuringLastMouseDown(false)
      setInitialMousePos({
        x: event.clientX,
        y: event.clientY,
      })
      return onMouseDown?.(event)
    },
    [onMouseDown],
  )

  const mouseUp = useCallback(
    (event: React.MouseEvent) => {
      setMouseIsDown(false)
      setInitialMousePos(undefined)
      return onMouseUp?.(event)
    },
    [onMouseUp],
  )

  const mouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!ref.current) {
        return
      }
      if (mouseIsDown && initialMousePos) {
        const dx = event.clientX - initialMousePos.x
        const dy = event.clientY - initialMousePos.y
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          setMovedDuringLastMouseDown(true)
        }
      }
      const { left, top } = ref.current.getBoundingClientRect()
      const offsetX = event.clientX - left
      const offsetY = event.clientY - top
      const px = region.reversed ? width - offsetX : offsetX
      const clientBp = region.start + bpPerPx * px

      const featureIdCurrentlyUnderMouse = displayModel.getFeatureOverlapping?.(
        blockKey,
        clientBp,
        offsetY,
      )

      if (onMouseMove) {
        onMouseMove(event, featureIdCurrentlyUnderMouse)
      }
    },
    [
      initialMousePos,
      blockKey,
      bpPerPx,
      mouseIsDown,
      onMouseMove,
      region.reversed,
      region.start,
      displayModel,
      width,
    ],
  )

  const click = useCallback(
    (event: React.MouseEvent) => {
      // don't select a feature if we are clicking and dragging
      if (movedDuringLastMouseDown) {
        return
      }
      onClick?.(event)
    },
    [movedDuringLastMouseDown, onClick],
  )

  useEffect(() => {
    setHeight(layout.getTotalHeight())
  }, [layout])

  return exportSVG ? (
    <RenderedFeatures
      displayMode={displayMode}
      isFeatureDisplayed={featureDisplayHandler}
      region={region}
      {...props}
    />
  ) : (
    <svg
      ref={ref}
      data-testid="svgfeatures"
      width={width}
      height={height + svgHeightPadding}
      style={{
        // use block because svg by default is inline, which adds a margin
        display: 'block',
      }}
      onMouseDown={mouseDown}
      onMouseUp={mouseUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onMouseMove={mouseMove}
      onClick={click}
    >
      <RenderedFeatures
        displayMode={displayMode}
        region={region}
        movedDuringLastMouseDown={movedDuringLastMouseDown}
        isFeatureDisplayed={featureDisplayHandler}
        {...props}
      />

      <SvgOverlay
        {...props}
        region={region}
        movedDuringLastMouseDown={movedDuringLastMouseDown}
      />
    </svg>
  )
})

export default SvgFeatureRendering
