import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import './SvgFeatureRendering.scss'

const fontWidthScaleFactor = 0.55
function Label({ layoutRecord, fontHeight, color, children }) {
  const otherProps = {}
  return (
    <text
      x={layoutRecord.left}
      y={layoutRecord.top}
      style={{ fontSize: fontHeight, fill: color }}
      dominantBaseline="hanging"
      {...otherProps}
    >
      {children}
    </text>
  )
}
Label.propTypes = {
  layoutRecord: ReactPropTypes.shape({
    left: ReactPropTypes.number.isRequired,
  }).isRequired,
  fontHeight: ReactPropTypes.number.isRequired,
  children: ReactPropTypes.node.isRequired,
  color: ReactPropTypes.string,
}
Label.defaultProps = {
  color: 'black',
}

function LabelText({ width, exp, fontWidth, text }) {
  const totalWidth = width + exp
  return (
    <>
      {fontWidth * text.length > totalWidth
        ? `${text.slice(0, totalWidth / fontWidth)}...`
        : text}
    </>
  )
}
LabelText.propTypes = {
  width: ReactPropTypes.number.isRequired,
  exp: ReactPropTypes.number.isRequired,
  fontWidth: ReactPropTypes.number.isRequired,
  text: ReactPropTypes.string.isRequired,
}

function Box(props) {
  function onFeatureMouseDown(event) {
    const { onFeatureMouseDown: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseEnter(event) {
    const { onFeatureMouseEnter: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseOut(event) {
    const { onFeatureMouseOut: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseOver(event) {
    const { onFeatureMouseOver: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseUp(event) {
    const { onFeatureMouseUp: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseLeave(event) {
    const { onFeatureMouseLeave: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseMove(event) {
    const { onFeatureMouseMove: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureClick(event) {
    const { onFeatureClick: handler, feature } = props
    if (!handler) return undefined
    event.stopPropagation()
    return handler(event, feature.id())
  }

  const {
    feature,
    config,
    layoutRecord: {
      rootLayout,
      name,
      description,
      shouldShowDescription,
      shouldShowName,
      fontHeight,
    },
    selectedFeatureId,
  } = props

  const featureLayout = rootLayout.getSubRecord('feature')
  const exp = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
  const fontWidth = fontHeight * fontWidthScaleFactor

  const width = Math.max(featureLayout.width, 1)
  const { top, left, height } = featureLayout

  const shapeProps = {
    title: feature.id(),
    'data-testid': feature.id(),
    onMouseDown: onFeatureMouseDown,
    onMouseEnter: onFeatureMouseEnter,
    onMouseOut: onFeatureMouseOut,
    onMouseOver: onFeatureMouseOver,
    onMouseUp: onFeatureMouseUp,
    onMouseLeave: onFeatureMouseLeave,
    onMouseMove: onFeatureMouseMove,
    onClick: onFeatureClick,
    onFocus: onFeatureMouseOver,
    onBlur: onFeatureMouseOut,
    transform: [-1, '-'].includes(feature.get('strand'))
      ? `rotate(180,${left + width / 2},${top + height / 2})`
      : undefined,
  }

  const ShapeComponent =
    width > height / 2 ? (
      <polygon
        {...shapeProps}
        fill={
          String(selectedFeatureId) === String(feature.id())
            ? 'red'
            : readConfObject(config, 'color1', [feature])
        }
        points={[
          [left, top],
          [left + width - height / 2, top],
          [left + width, top + height / 2],
          [left + width - height / 2, top + height],
          [left, top + height],
          [left + height / 2, top + height / 2],
        ]}
      />
    ) : (
      <polyline
        {...shapeProps}
        points={[
          [left, top],
          [left + width, top + height / 2],
          [left, top + height],
        ]}
        stroke={
          String(selectedFeatureId) === String(feature.id())
            ? 'red'
            : readConfObject(config, 'color1', [feature])
        }
        fill="none"
      />
    )

  return (
    <g transform={`translate(${rootLayout.left} ${rootLayout.top})`}>
      {ShapeComponent}
      {!shouldShowName ? null : (
        <Label
          layoutRecord={rootLayout.getSubRecord('nameLabel')}
          fontHeight={fontHeight}
          color={readConfObject(config, ['labels', 'nameColor'], [feature])}
        >
          <LabelText
            width={featureLayout.width}
            exp={exp}
            fontWidth={fontWidth}
            text={name}
          />
        </Label>
      )}
      {!shouldShowDescription ? null : (
        <Label
          layoutRecord={rootLayout.getSubRecord('descriptionLabel')}
          fontHeight={fontHeight}
          color={readConfObject(
            config,
            ['labels', 'descriptionColor'],
            [feature],
          )}
        >
          <LabelText
            width={featureLayout.width}
            exp={exp}
            fontWidth={fontWidth}
            text={description}
          />
        </Label>
      )}
    </g>
  )
}

Box.propTypes = {
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func.isRequired })
    .isRequired,
  // horizontallyFlipped: ReactPropTypes.bool,
  // bpPerPx: ReactPropTypes.number.isRequired,
  // region: CommonPropTypes.Region.isRequired,
  // config: CommonPropTypes.ConfigSchema.isRequired,
  layoutRecord: ReactPropTypes.shape({
    rootLayout: ReactPropTypes.shape({
      left: ReactPropTypes.number.isRequired,
    }).isRequired,
    name: ReactPropTypes.string,
    description: ReactPropTypes.string,
    shouldShowDescription: ReactPropTypes.bool,
    shouldShowName: ReactPropTypes.bool,
    fontHeight: ReactPropTypes.number,
  }).isRequired,

  selectedFeatureId: ReactPropTypes.string,

  config: CommonPropTypes.ConfigSchema.isRequired,

  onFeatureMouseDown: ReactPropTypes.func,
  onFeatureMouseEnter: ReactPropTypes.func,
  onFeatureMouseOut: ReactPropTypes.func,
  onFeatureMouseOver: ReactPropTypes.func,
  onFeatureMouseUp: ReactPropTypes.func,
  onFeatureMouseLeave: ReactPropTypes.func,
  onFeatureMouseMove: ReactPropTypes.func,

  // synthesized from mouseup and mousedown
  onFeatureClick: ReactPropTypes.func,
}

Box.defaultProps = {
  // horizontallyFlipped: false,

  selectedFeatureId: undefined,

  onFeatureMouseDown: undefined,
  onFeatureMouseEnter: undefined,
  onFeatureMouseOut: undefined,
  onFeatureMouseOver: undefined,
  onFeatureMouseUp: undefined,
  onFeatureMouseLeave: undefined,
  onFeatureMouseMove: undefined,

  onFeatureClick: undefined,
}

Box.layout = args => {
  const { feature, bpPerPx, region, layout, horizontallyFlipped } = args

  const [startPx, endPx] = featureSpanPx(
    feature,
    region,
    bpPerPx,
    horizontallyFlipped,
  )
  const rootLayout = new SceneGraph('root', startPx, 0, 0, 0)
  const featureHeight = readConfObject(args.config, 'height', [feature])
  const featureWidth = endPx - startPx
  rootLayout.addChild('feature', 0, 0, featureWidth, featureHeight)

  const name = readConfObject(args.config, ['labels', 'name'], [feature]) || ''
  const description =
    readConfObject(args.config, ['labels', 'description'], [feature]) || ''
  const fontHeight = readConfObject(
    args.config,
    ['labels', 'fontSize'],
    ['feature'],
  )
  const fontWidth = fontHeight * fontWidthScaleFactor
  const shouldShowName = /\S/.test(name)
  const shouldShowDescription = /\S/.test(description)
  const textVerticalPadding = 2
  let labelWidth
  let descriptionWidth
  const maxFeatureGlyphExpansion = readConfObject(
    args.config,
    'maxFeatureGlyphExpansion',
  )
  if (shouldShowName) {
    labelWidth = Math.round(
      Math.min(
        name.length * fontWidth,
        featureWidth + maxFeatureGlyphExpansion,
      ),
    )

    rootLayout.addChild(
      'nameLabel',
      0,
      rootLayout.getSubRecord('feature').bottom + textVerticalPadding,
      labelWidth,
      fontHeight,
    )
  }
  if (shouldShowDescription) {
    descriptionWidth = Math.round(
      Math.min(
        description.length * fontWidth,
        featureWidth + maxFeatureGlyphExpansion,
      ),
    )
    rootLayout.addChild(
      'descriptionLabel',
      0,
      rootLayout.getSubRecord(shouldShowName ? 'nameLabel' : 'feature').bottom +
        textVerticalPadding,
      descriptionWidth,
      fontHeight,
    )
  }

  const start = feature.get('start')
  const topPx = layout.addRect(
    feature.id(),
    start,
    start + rootLayout.width * bpPerPx,
    rootLayout.height,
  )

  rootLayout.move(0, topPx)

  return {
    rootLayout,
    name,
    description,
    shouldShowDescription,
    shouldShowName,
    fontHeight,
    labelWidth,
    descriptionWidth,
  }
}

export default observer(Box)
