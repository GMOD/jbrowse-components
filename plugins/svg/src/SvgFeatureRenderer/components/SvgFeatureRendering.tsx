import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { bpToPx, measureText } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'

import FeatureGlyph from './FeatureGlyph'
import SvgOverlay from './SvgOverlay'
import { chooseGlyphComponent, layOut } from './util'
import { Feature } from '@jbrowse/core/util/simpleFeature'

// used to make features have a little padding for their labels
const nameWidthPadding = 2
const textVerticalPadding = 2

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const svgHeightPadding = 100

function RenderedFeatureGlyph(props: {
  feature: Feature
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  displayMode: string
  layout: any
  extraGlyphs: any
}) {
  const { feature, bpPerPx, region, config, displayMode, layout, extraGlyphs } =
    props
  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)
  const labelsAllowed = displayMode !== 'compact' && displayMode !== 'collapsed'

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
  let shouldShowName
  let shouldShowDescription
  let name
  let description
  let fontHeight
  let expansion
  if (labelsAllowed) {
    const showLabels = readConfObject(config, 'showLabels')
    const showDescriptions = readConfObject(config, 'showDescriptions')
    fontHeight = readConfObject(config, ['labels', 'fontSize'], { feature })
    expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    name = readConfObject(config, ['labels', 'name'], { feature }) || ''
    shouldShowName = /\S/.test(name) && showLabels

    description =
      readConfObject(config, ['labels', 'description'], { feature }) || ''
    shouldShowDescription =
      /\S/.test(description) && showLabels && showDescriptions

    let nameWidth = 0
    if (shouldShowName) {
      nameWidth =
        Math.round(
          Math.min(measureText(name, fontHeight), rootLayout.width + expansion),
        ) + nameWidthPadding
      rootLayout.addChild(
        'nameLabel',
        0,
        featureLayout.bottom + textVerticalPadding,
        nameWidth,
        fontHeight,
      )
    }

    let descriptionWidth = 0
    if (shouldShowDescription) {
      const aboveLayout = shouldShowName
        ? rootLayout.getSubRecord('nameLabel')
        : featureLayout
      descriptionWidth =
        Math.round(
          Math.min(
            measureText(description, fontHeight),
            rootLayout.width + expansion,
          ),
        ) + nameWidthPadding
      rootLayout.addChild(
        'descriptionLabel',
        0,
        aboveLayout.bottom + textVerticalPadding,
        descriptionWidth,
        fontHeight,
      )
    }
  }

  const topPx = layout.addRect(
    feature.id(),
    feature.get('start'),
    feature.get('start') + rootLayout.width * bpPerPx,
    rootLayout.height,
  )
  if (topPx === null) {
    return null
  }
  rootLayout.move(startPx, topPx)

  return (
    <FeatureGlyph
      key={`svg-feature-${feature.id()}`}
      feature={feature}
      layout={layout}
      rootLayout={rootLayout}
      bpPerPx={bpPerPx}
      config={config}
      name={String(name)}
      shouldShowName={shouldShowName}
      description={String(description)}
      shouldShowDescription={shouldShowDescription}
      fontHeight={fontHeight}
      allowedWidthExpansion={expansion}
      reversed={region.reversed}
      {...props}
    />
  )
}

const RenderedFeatures = observer(props => {
  const { features, isFeatureDisplayed } = props
  const featuresRendered = []
  for (const feature of features.values()) {
    if (isFeatureDisplayed(feature)) {
      featuresRendered.push(
        <RenderedFeatureGlyph
          key={feature.id()}
          feature={feature}
          {...props}
        />,
      )
    }
  }
  return <>{featuresRendered}</>
})

function SvgFeatureRendering(props: {
  layout: any
  blockKey: string
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  features: Map<string, Feature>
  displayModel: any
  exportSVG: boolean
  featureDisplayHandler: (f: Feature) => boolean
  onMouseOut?: Function
  onMouseDown?: Function
  onMouseLeave?: Function
  onMouseEnter?: Function
  onMouseOver?: Function
  onMouseMove?: Function
  onMouseUp?: Function
  onClick?: Function
}) {
  const {
    layout,
    blockKey,
    regions,
    bpPerPx,
    features,
    config,
    displayModel,
    exportSVG,
    featureDisplayHandler = () => true,
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onClick,
  } = props
  const [region] = regions || []
  const width = (region.end - region.start) / bpPerPx
  const displayMode = readConfObject(config, 'displayMode') as string

  const ref = useRef<SVGSVGElement>()
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [height, setHeight] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const mouseDown = useCallback(
    event => {
      setMouseIsDown(true)
      setMovedDuringLastMouseDown(false)
      return onMouseDown?.(event)
    },
    [onMouseDown],
  )

  const mouseUp = useCallback(
    event => {
      setMouseIsDown(false)
      return onMouseUp?.(event)
    },
    [onMouseUp],
  )

  const mouseMove = useCallback(
    event => {
      if (!ref.current) {
        return
      }
      if (mouseIsDown) {
        setMovedDuringLastMouseDown(true)
      }
      let offsetX = 0
      let offsetY = 0
      if (ref.current) {
        offsetX = ref.current.getBoundingClientRect().left
        offsetY = ref.current.getBoundingClientRect().top
      }
      offsetX = event.clientX - offsetX
      offsetY = event.clientY - offsetY
      const px = region.reversed ? width - offsetX : offsetX
      const clientBp = region.start + bpPerPx * px

      const featureIdCurrentlyUnderMouse = displayModel.getFeatureOverlapping(
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
    event => {
      // don't select a feature if we are clicking and dragging
      if (movedDuringLastMouseDown) {
        return
      }
      if (onClick) {
        onClick(event)
      }
    },
    [movedDuringLastMouseDown, onClick],
  )

  useEffect(() => {
    setHeight(layout.getTotalHeight())
  }, [layout])

  if (exportSVG) {
    return (
      <RenderedFeatures
        features={features}
        displayMode={displayMode}
        isFeatureDisplayed={featureDisplayHandler}
        {...props}
        region={region}
      />
    )
  }
  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <svg
        ref={ref}
        className="SvgFeatureRendering"
        data-testid="svgfeatures"
        width={width}
        height={height + svgHeightPadding}
        onMouseDown={mouseDown}
        onMouseUp={mouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        onMouseMove={mouseMove}
        onClick={click}
        style={{ display: 'block' }}
      >
        <RenderedFeatures
          features={features}
          displayMode={displayMode}
          {...props}
          region={region}
          movedDuringLastMouseDown={movedDuringLastMouseDown}
          isFeatureDisplayed={featureDisplayHandler}
        />
        <SvgOverlay {...props} region={region} />
      </svg>
    </div>
  )
}

//SvgFeatureRendering.defaultProps = {
//  displayModel: {},
//  exportSVG: undefined,
//
//  features: new Map(),
//  blockKey: undefined,
//
//  onMouseDown: undefined,
//  onMouseUp: undefined,
//  onMouseEnter: undefined,
//  onMouseLeave: undefined,
//  onMouseOver: undefined,
//  onMouseOut: undefined,
//  onMouseMove: undefined,
//  onClick: undefined,
//  onContextMenu: undefined,
//  onFeatureClick: undefined,
//  onFeatureContextMenu: undefined,
//  extraGlyphs: [],
//  featureDisplayHandler: () => true,
//}

export default observer(SvgFeatureRendering)
