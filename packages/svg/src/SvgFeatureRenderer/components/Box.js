import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import './SvgFeatureRendering.scss'

function Label({ layoutRecord, fontHeight, labelWidth, color, children }) {
  const otherProps = {}
  if (labelWidth) otherProps.textLength = labelWidth
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
  labelWidth: ReactPropTypes.number.isRequired,
  children: ReactPropTypes.node.isRequired,
  color: ReactPropTypes.string,
}
Label.defaultProps = {
  color: 'black',
}

class Box extends Component {
  static propTypes = {
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

  static defaultProps = {
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

  static layout(args) {
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

    const name =
      readConfObject(args.config, ['labels', 'name'], [feature]) || ''
    const description =
      readConfObject(args.config, ['labels', 'description'], [feature]) || ''
    const fontHeight = readConfObject(
      args.config,
      ['labels', 'fontSize'],
      ['feature'],
    )
    const fontWidth = fontHeight * 0.55
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
        rootLayout.getSubRecord(shouldShowName ? 'nameLabel' : 'feature')
          .bottom + textVerticalPadding,
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

  onFeatureMouseDown = event => {
    const { onFeatureMouseDown: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseEnter = event => {
    const { onFeatureMouseEnter: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseOut = event => {
    const { onFeatureMouseOut: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseOver = event => {
    const { onFeatureMouseOver: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseUp = event => {
    const { onFeatureMouseUp: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseLeave = event => {
    const { onFeatureMouseLeave: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureMouseMove = event => {
    const { onFeatureMouseMove: handler, feature } = this.props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  onFeatureClick = event => {
    const { onFeatureClick: handler, feature } = this.props
    if (!handler) return undefined
    event.stopPropagation()
    return handler(event, feature.id())
  }

  render() {
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
        labelWidth,
        descriptionWidth,
      },
      selectedFeatureId,
    } = this.props

    const style = { fill: readConfObject(config, 'color1', [feature]) }
    if (String(selectedFeatureId) === String(feature.id())) {
      style.fill = 'red'
    }

    const featureLayout = rootLayout.getSubRecord('feature')

    return (
      <g transform={`translate(${rootLayout.left} ${rootLayout.top})`}>
        <rect
          title={feature.id()}
          data-testid={feature.id()}
          x={featureLayout.left}
          y={featureLayout.top}
          width={Math.max(featureLayout.width, 1)}
          height={featureLayout.height}
          style={style}
          onMouseDown={this.onFeatureMouseDown}
          onMouseEnter={this.onFeatureMouseEnter}
          onMouseOut={this.onFeatureMouseOut}
          onMouseOver={this.onFeatureMouseOver}
          onMouseUp={this.onFeatureMouseUp}
          onMouseLeave={this.onFeatureMouseLeave}
          onMouseMove={this.onFeatureMouseMove}
          onClick={this.onFeatureClick}
          onFocus={this.onFeatureMouseOver}
          onBlur={this.onFeatureMouseOut}
        />
        {!shouldShowName ? null : (
          <Label
            layoutRecord={rootLayout.getSubRecord('nameLabel')}
            fontHeight={fontHeight}
            color={readConfObject(config, ['labels', 'nameColor'], [feature])}
            labelWidth={labelWidth}
          >
            {name}
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
            labelWidth={descriptionWidth}
          >
            {description}
          </Label>
        )}
      </g>
    )
  }
}

export default observer(Box)
