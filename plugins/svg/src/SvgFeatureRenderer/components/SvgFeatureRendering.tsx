import React, { useEffect, useRef, useState, useCallback } from 'react'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  bpToPx,
  measureText,
  Region,
  Feature,
  getSession,
} from '@jbrowse/core/util'
import {
  BaseLayout,
  GranularRectLayout,
  SceneGraph,
} from '@jbrowse/core/util/layouts'

// locals
import FeatureGlyph from './FeatureGlyph'
import SvgOverlay from './SvgOverlay'
import {
  chooseGlyphComponent,
  layOut,
  ExtraGlyphValidator,
  DisplayModel,
} from './util'
import { getParent } from 'mobx-state-tree'

// used to make features have a little padding for their labels
const xPadding = 3
const yPadding = 5

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const svgHeightPadding = 100

function RenderedFeatureGlyph(props: {
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
  } = props

  // used for unit testing, difficult to mock out so it is in actual source code
  detectRerender?.()

  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)
  const labelAllowed = displayMode !== 'collapsed'

  const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
  const GlyphComponent = chooseGlyphComponent(feature, extraGlyphs)
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
      {...props}
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
  [key: string]: unknown
}) {
  const { features = new Map(), isFeatureDisplayed } = props
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
            {...props}
          />
        ))}
    </>
  )
})

const SvgFeatureRendering = observer(function SvgFeatureRendering({
  model,
}: {
  model: {
    region: Region
  }
}) {
  console.log({ model })
  const display = getParent<{ renderProps: () => Record<string, unknown> }>(
    model,
    2,
  )
  const { region } = model
  const props = display.renderProps()
  const height = 100
  const layout = new GranularRectLayout()
  const {
    blockKey,
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
  const [features, setFeatures] = useState()
  useEffect(() => {
    ;(async () => {
      const { rpcManager } = getSession(model)
      const { rpcSessionId } = getParent(display, 2)
      const feats = await rpcManager.call(rpcSessionId, 'CoreGetFeatures', {
        adapterConfig: display.adapterConfig,
        sessionId: rpcSessionId,
        regions: [region],
      })
      console.log({ feats })
      feats.forEach(f => {
        layout.addRect(f.get('start'), f.get('end'), 0, 100)
      })
      setFeatures(feats)
    })()
  }, [model, display, region])

  const width = (region.end - region.start) / bpPerPx
  const displayMode = readConfObject(config, 'displayMode') as string

  const ref = useRef<SVGSVGElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)

  const mouseDown = useCallback(
    (event: React.MouseEvent) => {
      setMouseIsDown(true)
      setMovedDuringLastMouseDown(false)
      return onMouseDown?.(event)
    },
    [onMouseDown],
  )

  const mouseUp = useCallback(
    (event: React.MouseEvent) => {
      setMouseIsDown(false)
      return onMouseUp?.(event)
    },
    [onMouseUp],
  )

  const mouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!ref.current) {
        return
      }
      if (mouseIsDown) {
        setMovedDuringLastMouseDown(true)
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
