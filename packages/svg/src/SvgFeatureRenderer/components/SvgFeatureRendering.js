import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/util/types/mst'
import { bpToPx, bpSpanPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import FeatureGlyph from './FeatureGlyph'
import { chooseGlyphComponent, layOut } from './util'

const fontWidthScaleFactor = 0.6
const renderingStyle = {
  position: 'relative',
}

export const SvgSelected = observer(
  ({
    region,
    trackModel: { blockLayoutFeatures, selectedFeatureId },
    bpPerPx,
    blockKey,
  }) => {
    if (selectedFeatureId && blockLayoutFeatures) {
      const blockLayout = blockLayoutFeatures.get(blockKey)
      if (blockLayout) {
        const rect = blockLayout.get(selectedFeatureId)
        if (rect) {
          const [leftBp, topPx, rightBp, bottomPx] = rect
          const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
          const rectTop = Math.round(topPx)
          const screenWidth = (region.end - region.start) / bpPerPx
          const rectHeight = Math.round(bottomPx - topPx)
          const width = rightPx - leftPx

          if (leftPx + width < 0) {
            return null
          }
          const leftWithinBlock = Math.max(leftPx, 0)
          const diff = leftWithinBlock - leftPx
          const widthWithinBlock = Math.max(
            1,
            Math.min(width - diff, screenWidth),
          )

          return (
            <rect
              x={leftWithinBlock - 2}
              y={rectTop - 2}
              width={widthWithinBlock + 4}
              height={rectHeight + 4}
              stroke="#00b8ff"
              fill="none"
            />
          )
        }
      }
    }
    return null
  },
)

export const SvgMouseover = observer(
  ({
    trackModel: { blockLayoutFeatures, featureIdUnderMouse },
    region,
    bpPerPx,
    blockKey,
  }) => {
    if (featureIdUnderMouse && blockLayoutFeatures) {
      const blockLayout = blockLayoutFeatures.get(blockKey)
      if (blockLayout) {
        const rect = blockLayout.get(featureIdUnderMouse)
        if (rect) {
          const [leftBp, topPx, rightBp, bottomPx] = rect
          const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
          const screenWidth = (region.end - region.start) / bpPerPx
          const rectTop = Math.round(topPx)
          const rectHeight = Math.round(bottomPx - topPx)
          const width = rightPx - leftPx

          if (leftPx + width < 0) {
            return null
          }
          const leftWithinBlock = Math.max(leftPx, 0)
          const diff = leftWithinBlock - leftPx
          const widthWithinBlock = Math.max(
            1,
            Math.min(width - diff, screenWidth),
          )

          return (
            <rect
              x={leftWithinBlock - 2}
              y={rectTop - 2}
              width={widthWithinBlock + 4}
              height={rectHeight + 4}
              fill="#000"
              fillOpacity="0.2"
            />
          )
        }
      }
    }
    return null
  },
)

function RenderedFeatureGlyph(props) {
  const { feature, bpPerPx, region, config, displayMode, layout } = props
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
      reversed={region.reversed}
      {...props}
    />
  )
}

RenderedFeatureGlyph.propTypes = {
  layout: ReactPropTypes.shape({
    addRect: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,

  displayMode: ReactPropTypes.string.isRequired,
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({
    id: ReactPropTypes.func.isRequired,
    get: ReactPropTypes.func.isRequired,
  }).isRequired,
  config: CommonPropTypes.ConfigSchema.isRequired,
}

const RenderedFeatures = observer(props => {
  const { features } = props
  const featuresRendered = []
  for (const feature of features.values()) {
    featuresRendered.push(
      <RenderedFeatureGlyph key={feature.id()} feature={feature} {...props} />,
    )
  }
  return <>{featuresRendered}</>
})
RenderedFeatures.propTypes = {
  features: ReactPropTypes.oneOfType([
    ReactPropTypes.instanceOf(Map),
    ReactPropTypes.arrayOf(ReactPropTypes.shape()),
  ]),
  layout: ReactPropTypes.shape({
    addRect: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,
}

RenderedFeatures.defaultProps = {
  features: [],
}

function SvgFeatureRendering(props) {
  const {
    layout,
    blockKey,
    regions,
    bpPerPx,
    features,
    trackModel,
    config,
  } = props
  const [region] = regions || []
  const width = (region.end - region.start) / bpPerPx
  const displayMode = readConfObject(config, 'displayMode')

  const ref = useRef()
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(
    false,
  )
  const [height, setHeight] = useState(0)
  const {
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onFeatureClick,
    onFeatureContextMenu,
  } = props

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
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseLeave],
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

      const feats = trackModel.getFeatureOverlapping(
        blockKey,
        clientBp,
        offsetY,
      )
      const featureIdCurrentlyUnderMouse = feats.length
        ? feats[0].name
        : undefined

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
      trackModel,
      width,
    ],
  )

  const click = useCallback(
    event => {
      // don't select a feature if we are clicking and dragging
      if (movedDuringLastMouseDown) {
        return
      }
      if (onFeatureClick) {
        onFeatureClick(event)
      }
    },
    [movedDuringLastMouseDown, onFeatureClick],
  )

  const contextMenu = useCallback(
    event => {
      if (movedDuringLastMouseDown) {
        return
      }
      if (onFeatureContextMenu) {
        onFeatureContextMenu(event)
      }
    },
    [movedDuringLastMouseDown, onFeatureContextMenu],
  )

  useEffect(() => {
    setHeight(layout.getTotalHeight())
  }, [layout])

  return (
    <div style={renderingStyle}>
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
        onContextMenu={contextMenu}
        style={{ display: 'block' }}
      >
        <RenderedFeatures
          features={features}
          displayMode={displayMode}
          {...props}
          region={region}
        />
        <SvgSelected {...props} region={region} />
        <SvgMouseover {...props} region={region} />
      </svg>
    </div>
  )
}

SvgFeatureRendering.propTypes = {
  layout: ReactPropTypes.shape({
    addRect: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,

  regions: ReactPropTypes.arrayOf(CommonPropTypes.Region).isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  features: ReactPropTypes.oneOfType([
    ReactPropTypes.instanceOf(Map),
    ReactPropTypes.arrayOf(ReactPropTypes.shape()),
  ]),
  config: CommonPropTypes.ConfigSchema.isRequired,
  trackModel: ReactPropTypes.shape({
    configuration: ReactPropTypes.shape({}),
    getFeatureOverlapping: ReactPropTypes.func,
    selectedFeatureId: ReactPropTypes.string,
    featureIdUnderMouse: ReactPropTypes.string,
  }),

  onMouseDown: ReactPropTypes.func,
  onMouseUp: ReactPropTypes.func,
  onMouseEnter: ReactPropTypes.func,
  onMouseLeave: ReactPropTypes.func,
  onMouseOver: ReactPropTypes.func,
  onMouseOut: ReactPropTypes.func,
  onMouseMove: ReactPropTypes.func,
  onClick: ReactPropTypes.func,
  onContextMenu: ReactPropTypes.func,
  onFeatureClick: ReactPropTypes.func,
  onFeatureContextMenu: ReactPropTypes.func,
  blockKey: ReactPropTypes.string,
}

SvgFeatureRendering.defaultProps = {
  trackModel: {},

  features: new Map(),
  blockKey: undefined,

  onMouseDown: undefined,
  onMouseUp: undefined,
  onMouseEnter: undefined,
  onMouseLeave: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onMouseMove: undefined,
  onClick: undefined,
  onContextMenu: undefined,
  onFeatureClick: undefined,
  onFeatureContextMenu: undefined,
}

export default observer(SvgFeatureRendering)
