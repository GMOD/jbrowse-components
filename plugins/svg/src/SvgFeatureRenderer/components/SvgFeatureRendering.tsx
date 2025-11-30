import { useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { bpToPx, calculateLayoutBounds } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import { observer } from 'mobx-react'

import FeatureGlyph from './FeatureGlyph'
import SvgOverlay from './SvgOverlay'
import {
  chooseGlyphComponent,
  computeLabelLayout,
  layOut,
  xPadding,
  yPadding,
} from './util'

import type { Coord, DisplayModel, ExtraGlyphValidator } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

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
}) {
  const { feature, detectRerender, bpPerPx, region, config, displayMode, layout, extraGlyphs } =
    props

  detectRerender?.()

  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)

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

  const { name, description, shouldShowName, shouldShowDescription, fontHeight, expansion } =
    computeLabelLayout({
      feature,
      config,
      rootLayout,
      featureLayout,
      displayMode,
    })

  const layoutWidthBp = rootLayout.width * bpPerPx + xPadding * bpPerPx
  const [layoutStart, layoutEnd] = calculateLayoutBounds(
    feature.get('start'),
    feature.get('end'),
    layoutWidthBp,
    reversed,
  )

  const topPx = layout.addRect(
    feature.id(),
    layoutStart,
    layoutEnd,
    rootLayout.height + yPadding,
    feature,
    {
      label: feature.get('name') || feature.get('id'),
      description: feature.get('description') || feature.get('note'),
      refName: feature.get('refName'),
      totalLayoutWidth: rootLayout.width + xPadding,
    },
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
  displayModel?: DisplayModel
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
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(false)
  const [initialMousePos, setInitialMousePos] = useState<Coord>()

  return (
    <svg
      ref={ref}
      data-testid="svgfeatures"
      width={width}
      height={layout.getTotalHeight() + svgHeightPadding}
      style={{ display: 'block' }}
      onMouseDown={event => {
        setMouseIsDown(true)
        setMovedDuringLastMouseDown(false)
        setInitialMousePos({ x: event.clientX, y: event.clientY })
        onMouseDown?.(event)
      }}
      onMouseUp={event => {
        setMouseIsDown(false)
        setInitialMousePos(undefined)
        onMouseUp?.(event)
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
        onMouseMove?.(
          event,
          displayModel.getFeatureOverlapping?.(blockKey, clientBp, offsetY),
        )
      }}
      onClick={event => {
        if (!movedDuringLastMouseDown) {
          onClick?.(event)
        }
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
