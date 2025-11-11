import { useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { bpToPx, measureText } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import { observer } from 'mobx-react'

import FeatureGlyph from './FeatureGlyph'
import SvgOverlay from './SvgOverlay'
import { chooseGlyphComponent, layOut } from './util'

import type {
  Coord,
  DisplayModel,
  ExtraGlyphValidator,
  ViewParams,
} from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

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
  viewParams: ViewParams
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
    {
      label: feature.get('name') || feature.get('id'),
      description: feature.get('description') || feature.get('note'),
      refName: feature.get('refName'),
    },
  )
  if (topPx === null) {
    return null
  } else {
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
}

const RenderedFeatures = observer(function (props: {
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
  viewParams: ViewParams
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
  const { regions = [], config, exportSVG, featureDisplayHandler } = props
  const region = regions[0]!
  const displayMode = readConfObject(config, 'displayMode') as string

  return exportSVG ? (
    <RenderedFeatures
      displayMode={displayMode}
      isFeatureDisplayed={featureDisplayHandler}
      region={region}
      {...props}
    />
  ) : (
    <Wrapper {...props}>
      <RenderedFeatures
        displayMode={displayMode}
        region={region}
        isFeatureDisplayed={featureDisplayHandler}
        {...props}
      />
    </Wrapper>
  )
})

function Wrapper(props: {
  layout: BaseLayout<unknown>
  children: React.ReactNode
  blockKey: string
  regions: Region[]
  bpPerPx: number
  detectRerender?: () => void
  config: AnyConfigurationModel
  colorByCDS: boolean
  features: Map<string, Feature>
  displayModel?: DisplayModel
  viewParams: ViewParams
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
    displayModel = {},
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onClick,
    children,
  } = props

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const ref = useRef<SVGSVGElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const [initialMousePos, setInitialMousePos] = useState<Coord>()

  const height = layout.getTotalHeight()

  return (
    <svg
      ref={ref}
      data-testid="svgfeatures"
      width={width}
      height={height + svgHeightPadding}
      style={{
        // use block because svg by default is inline, which adds a margin
        display: 'block',
      }}
      onMouseDown={event => {
        setMouseIsDown(true)
        setMovedDuringLastMouseDown(false)
        setInitialMousePos({
          x: event.clientX,
          y: event.clientY,
        })
        return onMouseDown?.(event)
      }}
      onMouseUp={event => {
        setMouseIsDown(false)
        setInitialMousePos(undefined)
        return onMouseUp?.(event)
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onMouseMove={event => {
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

        const featureIdCurrentlyUnderMouse =
          displayModel.getFeatureOverlapping?.(blockKey, clientBp, offsetY)

        if (onMouseMove) {
          onMouseMove(event, featureIdCurrentlyUnderMouse)
        }
      }}
      onClick={event => {
        // don't select a feature if we are clicking and dragging
        if (movedDuringLastMouseDown) {
          return
        }
        onClick?.(event)
      }}
    >
      {children}
      <SvgOverlay
        {...props}
        region={region}
        movedDuringLastMouseDown={movedDuringLastMouseDown}
      />
    </svg>
  )
}

export default SvgFeatureRendering
