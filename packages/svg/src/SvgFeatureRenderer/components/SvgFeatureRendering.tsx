import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { bpToPx, bpSpanPx } from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { observer } from 'mobx-react'
import React, { useRef, useState, useCallback } from 'react'
import { Tooltip } from '@gmod/jbrowse-core/ui'
import { BaseLayout } from '@gmod/jbrowse-core/util/layouts/BaseLayout'
import FeatureGlyph from './FeatureGlyph'
import { chooseGlyphComponent, layOut } from './util'

const fontWidthScaleFactor = 0.6

interface BaseTrackModel {
  configuration: AnyConfigurationModel
  blockLayoutFeatures: Map<string, Feature>
  featureIdUnderMouse: string
  selectedFeatureId: string
  setFeatureIdUnderMouse: (arg0: string | undefined) => void
  getFeatureOverlapping: (
    blockKey: string,
    bp: number,
    y: number,
  ) => { name: string }[]
}

export interface SvgFeatureRenderingProps {
  blockKey: string
  regions: IRegion[]
  bpPerPx: number
  horizontallyFlipped?: boolean
  features: Map<string, Feature>
  trackModel: BaseTrackModel
  layout: BaseLayout<string>
  config: AnyConfigurationModel
  onMouseOut?: Function
  onMouseDown?: Function
  onMouseLeave?: Function
  onMouseEnter?: Function
  onMouseOver?: Function
  onMouseMove?: Function
  onMouseUp?: Function
  onFeatureClick?: Function
}
export const SvgSelected = observer((props: SvgFeatureRenderingProps) => {
  const {
    regions,
    trackModel: { selectedFeatureId, blockLayoutFeatures },
    blockKey,
    bpPerPx,
  } = props
  const [region] = regions || []
  if (selectedFeatureId && blockLayoutFeatures) {
    const blockLayout = blockLayoutFeatures.get(blockKey)
    if (blockLayout) {
      const rect = blockLayout.get(selectedFeatureId)
      if (rect) {
        const [leftBp, topPx, rightBp, bottomPx] = rect
        const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
        const rectTop = Math.round(topPx)
        const rectHeight = Math.round(bottomPx - topPx)

        return (
          <rect
            x={leftPx - 2}
            y={rectTop - 2}
            width={rightPx - leftPx + 4}
            height={rectHeight + 4}
            stroke="#00b8ff"
            fill="none"
          />
        )
      }
    }
  }
  return null
})

export const SvgMouseover = observer((props: SvgFeatureRenderingProps) => {
  const {
    regions,
    trackModel: { featureIdUnderMouse, blockLayoutFeatures },
    blockKey,
    bpPerPx,
  } = props
  const [region] = regions || []
  if (featureIdUnderMouse && blockLayoutFeatures) {
    const blockLayout = blockLayoutFeatures.get(blockKey)
    if (blockLayout) {
      const rect = blockLayout.get(featureIdUnderMouse)
      if (rect) {
        const [leftBp, topPx, rightBp, bottomPx] = rect
        const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
        const rectTop = Math.round(topPx)
        const rectHeight = Math.round(bottomPx - topPx)
        return (
          <rect
            x={leftPx - 2}
            y={rectTop - 2}
            width={rightPx - leftPx + 4}
            height={rectHeight + 4}
            fill="#000"
            fillOpacity="0.2"
          />
        )
      }
    }
  }
  return null
})

function RenderedFeatureGlyph(
  props: SvgFeatureRenderingProps & { displayMode: string; feature: Feature },
) {
  const { feature, bpPerPx, regions, config, displayMode, layout } = props
  const [region] = regions || []
  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)
  const labelsAllowed = displayMode !== 'compact' && displayMode !== 'collapsed'

  const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
  const GlyphComponent = chooseGlyphComponent(feature)
  const featureLayout = (GlyphComponent.layOut || layOut)({
    layout: rootLayout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  let shouldShowName
  let shouldShowDescription
  let name
  let description
  let fontHeight
  let expansion
  if (labelsAllowed) {
    fontHeight = readConfObject(config, ['labels', 'fontSize'], ['feature'])
    expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    name = readConfObject(config, ['labels', 'name'], [feature]) || ''
    shouldShowName = /\S/.test(name)

    description =
      readConfObject(config, ['labels', 'description'], [feature]) || ''
    shouldShowDescription = /\S/.test(description)
    const fontWidth = fontHeight * fontWidthScaleFactor
    const textVerticalPadding = 2

    let nameWidth = 0
    if (shouldShowName) {
      nameWidth = Math.round(
        Math.min(name.length * fontWidth, rootLayout.width + expansion),
      )
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
      descriptionWidth = Math.round(
        Math.min(description.length * fontWidth, rootLayout.width + expansion),
      )
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
      name={name}
      shouldShowName={shouldShowName}
      description={description}
      shouldShowDescription={shouldShowDescription}
      fontHeight={fontHeight}
      allowedWidthExpansion={expansion}
      {...props}
    />
  )
}

const RenderedFeatures = observer(
  (
    props: SvgFeatureRenderingProps & {
      setHeight: Function
      displayMode: string
    },
  ) => {
    const { layout, setHeight, features } = props
    const featuresRendered: JSX.Element[] = []
    for (const feature of features.values()) {
      featuresRendered.push(
        <RenderedFeatureGlyph
          key={feature.id()}
          feature={feature}
          {...props}
        />,
      )
    }
    setHeight(layout.getTotalHeight())
    return <>{featuresRendered}</>
  },
)

function SvgFeatureRendering(props: SvgFeatureRenderingProps) {
  const {
    blockKey = '',
    regions,
    bpPerPx,
    horizontallyFlipped = false,
    features,
    trackModel,
    config,
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onFeatureClick,
  } = props
  const { configuration } = trackModel
  const [region] = regions || []
  const width = (region.end - region.start) / bpPerPx
  const displayMode = readConfObject(config, 'displayMode')

  const ref = useRef<SVGSVGElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [localFeatureIdUnderMouse, setLocalFeatureIdUnderMouse] = useState<
    undefined | string
  >()
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(
    false,
  )
  const [tooltipCoord, setTooltipCoord] = useState([0, 0])
  const [height, setHeight] = useState(0)

  const mouseDown = useCallback(
    event => {
      setMouseIsDown(true)
      setMovedDuringLastMouseDown(false)
      const handler = onMouseDown
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseDown],
  )

  const mouseUp = useCallback(
    event => {
      setMouseIsDown(false)
      const handler = onMouseUp
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseUp],
  )

  const mouseEnter = useCallback(
    event => {
      const handler = onMouseEnter
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseEnter],
  )

  const mouseLeave = useCallback(
    event => {
      const handler = onMouseLeave
      setLocalFeatureIdUnderMouse(undefined)
      trackModel.setFeatureIdUnderMouse(undefined)
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseLeave, trackModel],
  )

  const mouseOver = useCallback(
    event => {
      const handler = onMouseOver
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseOver],
  )

  const mouseOut = useCallback(
    event => {
      const handler = onMouseOut
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseOut],
  )

  const mouseMove = useCallback(
    event => {
      const handler = onMouseMove
      if (mouseIsDown) setMovedDuringLastMouseDown(true)
      let offsetX = 0
      let offsetY = 0
      if (ref.current) {
        offsetX = ref.current.getBoundingClientRect().left
        offsetY = ref.current.getBoundingClientRect().top
      }
      offsetX = event.clientX - offsetX
      offsetY = event.clientY - offsetY
      const px = horizontallyFlipped ? width - offsetX : offsetX
      const clientBp = region.start + bpPerPx * px

      const feats = trackModel.getFeatureOverlapping(
        blockKey,
        clientBp,
        offsetY,
      )
      const featureIdCurrentlyUnderMouse = feats.length
        ? feats[0].name
        : undefined
      setTooltipCoord([offsetX, offsetY])
      setLocalFeatureIdUnderMouse(featureIdCurrentlyUnderMouse)
      trackModel.setFeatureIdUnderMouse(featureIdCurrentlyUnderMouse)

      if (!handler) return undefined
      return handler(event)
    },
    [
      blockKey,
      bpPerPx,
      horizontallyFlipped,
      mouseIsDown,
      onMouseMove,
      region.start,
      trackModel,
      width,
    ],
  )

  const click = useCallback(
    event => {
      // don't select a feature if we are clicking and dragging
      if (movedDuringLastMouseDown) return

      onFeatureClick && onFeatureClick(event)
    },
    [movedDuringLastMouseDown, onFeatureClick],
  )

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref}
        className="SvgFeatureRendering"
        width={`${width}px`}
        height={`${height}px`}
        onMouseDown={mouseDown}
        onMouseUp={mouseUp}
        onMouseEnter={mouseEnter}
        onMouseLeave={mouseLeave}
        onMouseOver={mouseOver}
        onMouseOut={mouseOut}
        onMouseMove={mouseMove}
        onFocus={mouseEnter}
        onBlur={mouseLeave}
        onClick={click}
        style={{ display: 'block' }}
      >
        <RenderedFeatures
          features={features}
          setHeight={setHeight}
          displayMode={displayMode}
          {...props}
        />
        <SvgSelected {...props} />
        <SvgMouseover {...props} />
      </svg>
      {localFeatureIdUnderMouse ? (
        <Tooltip
          configuration={configuration}
          feature={features.get(localFeatureIdUnderMouse)}
          offsetX={tooltipCoord[0]}
          offsetY={tooltipCoord[1]}
        />
      ) : null}
    </div>
  )
}

export default observer(SvgFeatureRendering)
