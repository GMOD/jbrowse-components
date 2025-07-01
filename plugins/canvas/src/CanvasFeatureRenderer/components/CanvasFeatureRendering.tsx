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

// used to make features have a little padding for their labels
const xPadding = 3
const yPadding = 5

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const canvasHeightPadding = 100

export function RenderedFeatureGlyph(props: {
  feature: Feature
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  colorByCDS: boolean
  layout: BaseLayout<unknown>
  extraGlyphs?: ExtraGlyphValidator[]
  displayMode: string
  exportSVG?: unknown
  displayModel?: DisplayModel
  detectRerender?: () => void
  viewParams: {
    start: number
    end: number
    offsetPx: number
    offsetPx1: number
  }
  ctx: CanvasRenderingContext2D // Added ctx here
  [key: string]: unknown
}) {
  const {
    feature,
    detectRerender,
    bpPerPx,
    region,
    config,
    displayMode,
    layout,
    extraGlyphs,
    ctx, // Destructure ctx
    ...rest // Capture remaining props
  } = props

  // used for unit testing, difficult to mock out so it is in actual source code
  detectRerender?.()

  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)
  const labelAllowed = displayMode !== 'collapsed'

  const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
  const GlyphComponent = chooseGlyphComponent({ config, feature, extraGlyphs })
  const featureLayout = (GlyphComponent.layOut || layOut)({
    layout: rootLayout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  let shouldShowName = false
  let shouldShowDescription = false
  let name = ''
  let description = ''
  let fontHeight = 0
  let expansion = 0
  if (labelAllowed) {
    const showLabels = readConfObject(config, 'showLabels')
    const showDescriptions = readConfObject(config, 'showDescriptions')
    fontHeight = readConfObject(config, ['labels', 'fontSize'], { feature })
    expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    name = String(readConfObject(config, ['labels', 'name'], { feature }) || '')
    shouldShowName = /\S/.test(name) && showLabels

    const getWidth = (text: string) => {
      const glyphWidth = rootLayout.width + expansion
      const textWidth = measureText(text, fontHeight)
      return Math.round(Math.min(textWidth, glyphWidth))
    }

    description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )
    shouldShowDescription = /\S/.test(description) && showDescriptions

    if (shouldShowName) {
      rootLayout.addChild(
        'nameLabel',
        0,
        featureLayout.bottom,
        getWidth(name),
        fontHeight,
      )
    }

    if (shouldShowDescription) {
      const aboveLayout = shouldShowName
        ? rootLayout.getSubRecord('nameLabel')
        : featureLayout
      if (!aboveLayout) {
        throw new Error('failed to layout nameLabel')
      }

      rootLayout.addChild(
        'descriptionLabel',
        0,
        aboveLayout.bottom,
        getWidth(description),
        fontHeight,
      )
    }
  }

  const topPx = layout.addRect(
    feature.id(),
    feature.get('start'),
    feature.get('start') + rootLayout.width * bpPerPx + xPadding * bpPerPx,
    rootLayout.height + yPadding,
  )
  if (topPx === null) {
    return null
  }
  rootLayout.move(startPx, topPx)

  return (
    <FeatureGlyph
      rootLayout={rootLayout}
      name={name}
      shouldShowName={shouldShowName}
      description={description}
      shouldShowDescription={shouldShowDescription}
      fontHeight={fontHeight}
      allowedWidthExpansion={expansion}
      reversed={region.reversed}
      topLevel={true}
      ctx={ctx} // Pass ctx here
      {...rest} // Pass remaining props
    />
  )
}

const RenderedFeatures = observer(function RenderedFeatures(props: {
  features?: Map<string, Feature>
  isFeatureDisplayed?: (f: Feature) => boolean
  bpPerPx: number
  config: AnyConfigurationModel
  displayMode: string
  colorByCDS: boolean
  displayModel?: DisplayModel
  region: Region
  exportSVG?: unknown
  extraGlyphs?: ExtraGlyphValidator[]
  layout: BaseLayout<unknown>
  viewParams: {
    start: number
    end: number
    offsetPx: number
    offsetPx1: number
  }
  ctx: CanvasRenderingContext2D // Added ctx here
  [key: string]: unknown
}) {
  const { features = new Map(), isFeatureDisplayed, ctx, ...rest } = props
  return (
    <>
      {[...features.values()]
        .filter(feature =>
          isFeatureDisplayed ? isFeatureDisplayed(feature) : true,
        )
        .map(feature => (
          <RenderedFeatureGlyph
            key={feature.id()}
            feature={feature}
            ctx={ctx} // Pass ctx here
            {...rest} // Pass remaining props
          />
        ))}
    </>
  )
})

const CanvasFeatureRendering = observer(function CanvasFeatureRendering(props: {
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
  viewParams: {
    start: number
    end: number
    offsetPx: number
    offsetPx1: number
  }
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

  const ref = useRef<HTMLCanvasElement>(null)
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

  // Get the canvas context and draw features
  useEffect(() => {
    const canvas = ref.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        // Pass the context to RenderedFeatures and CanvasOverlay
        // This will trigger re-renders of those components, which will then draw on the canvas
        // The actual drawing logic is within RenderedFeatures and CanvasOverlay
      }
    }
  }, [height, width, props]) // Re-draw when height, width, or props change

  return exportSVG ? (
    <RenderedFeatures
      displayMode={displayMode}
      isFeatureDisplayed={featureDisplayHandler}
      region={region}
      ctx={ref.current?.getContext('2d')!} // Pass ctx here
      {...props}
    />
  ) : (
    <canvas
      ref={ref}
      data-testid="canvasfeatures"
      width={width}
      height={height + canvasHeightPadding}
      style={{
        // use block because canvas by default is inline, which adds a margin
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
      {/* RenderedFeatures and CanvasOverlay will receive the ctx prop via props.children */}
      {ref.current && ref.current.getContext('2d') && (
        <>
          <RenderedFeatures
            displayMode={displayMode}
            region={region}
            movedDuringLastMouseDown={movedDuringLastMouseDown}
            isFeatureDisplayed={featureDisplayHandler}
            ctx={ref.current.getContext('2d')!} // Pass ctx here
            {...props}
          />

          <CanvasOverlay
            {...props}
            region={region}
            movedDuringLastMouseDown={movedDuringLastMouseDown}
            ctx={ref.current.getContext('2d')!} // Pass ctx here
          />
        </>
      )}
    </canvas>
  )
})

export default CanvasFeatureRendering