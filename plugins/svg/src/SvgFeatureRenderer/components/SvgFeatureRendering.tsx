import { useRef, useState } from 'react'

import { bpToPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Box from './Box'
import CDS from './CDS'
import ProcessedTranscript from './ProcessedTranscript'
import Segments from './Segments'
import Subfeatures from './Subfeatures'
import SvgOverlay from './SvgOverlay'
import { buildFeatureMap, createRenderConfigContext } from './util'

import type {
  Coord,
  DisplayModel,
  FeatureLayout,
  RenderConfigContext,
} from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import type { Theme } from '@mui/material'

const svgHeightPadding = 100

const GlyphComponents = {
  Box,
  CDS,
  ProcessedTranscript,
  Segments,
  Subfeatures,
}

function FeatureGlyph(props: {
  feature: Feature
  featureLayout: FeatureLayout
  features: Map<string, Feature>
  region: Region
  bpPerPx: number
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  displayModel?: DisplayModel
  topLevel?: boolean
  selected?: boolean
  theme: Theme
}) {
  const { featureLayout, features } = props
  const { glyphType, children } = featureLayout
  const GlyphComponent = GlyphComponents[glyphType]

  return (
    <>
      <GlyphComponent {...props} />
      {children.map(childLayout => {
        const childFeature = features.get(childLayout.featureId)
        if (!childFeature) {
          return null
        }
        return (
          <FeatureGlyph
            key={childLayout.featureId}
            {...props}
            feature={childFeature}
            featureLayout={childLayout}
            topLevel={false}
          />
        )
      })}
    </>
  )
}

function RenderedFeatureGlyph(props: {
  feature: Feature
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  layout: BaseLayout<unknown>
  displayModel?: DisplayModel
  theme: Theme
  detectRerender?: () => void
}) {
  const { feature, detectRerender, bpPerPx, region, layout } = props

  detectRerender?.()

  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)

  const layoutData = layout.getRectangles().get(feature.id())
  if (!layoutData) {
    return null
  }

  // getRectangles returns [left, top, right, bottom, serializableData]
  const [, topPx, , , data] = layoutData as [
    number,
    number,
    number,
    number,
    { featureLayout: FeatureLayout }?,
  ]
  const featureLayout = data?.featureLayout
  if (!featureLayout) {
    return null
  }

  return (
    <g transform={`translate(${startPx}, ${topPx})`}>
      <FeatureGlyph {...props} featureLayout={featureLayout} topLevel />
    </g>
  )
}

const RenderedFeatures = observer(function (props: {
  features?: Map<string, Feature>
  isFeatureDisplayed?: (f: Feature) => boolean
  bpPerPx: number
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  displayModel?: DisplayModel
  region: Region
  layout: BaseLayout<unknown>
  theme: Theme
}) {
  const { features = new Map(), isFeatureDisplayed, config, ...rest } = props
  const allFeatures = buildFeatureMap(features, config)
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
            features={allFeatures}
            config={config}
            {...rest}
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
  configContext?: RenderConfigContext
  colorByCDS: boolean
  features: Map<string, Feature>
  displayModel?: DisplayModel
  exportSVG?: boolean
  featureDisplayHandler?: (f: Feature) => boolean
  theme: Theme
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
    regions = [],
    config,
    exportSVG,
    featureDisplayHandler,
    configContext: propsConfigContext,
  } = props
  const region = regions[0]!
  const configContext = propsConfigContext ?? createRenderConfigContext(config)

  return exportSVG ? (
    <RenderedFeatures
      configContext={configContext}
      isFeatureDisplayed={featureDisplayHandler}
      region={region}
      {...props}
    />
  ) : (
    <Wrapper {...props}>
      <RenderedFeatures
        configContext={configContext}
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
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
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
