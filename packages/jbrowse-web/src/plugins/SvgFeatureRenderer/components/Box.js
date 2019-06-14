import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'

import './SvgFeatureRendering.scss'

import { observer } from 'mobx-react'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'

function Label({ layoutRecord, fontHeight, color, children }) {
  return (
    <text
      x={layoutRecord.left}
      y={layoutRecord.top}
      style={{ fontSize: fontHeight, fill: color }}
      dominantBaseline="hanging"
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
    rootLayout.addChild('feature', 0, 0, endPx - startPx, featureHeight)

    const name =
      readConfObject(args.config, ['labels', 'name'], [feature]) || ''
    const description =
      readConfObject(args.config, ['labels', 'description'], [feature]) || ''
    const fontHeight = readConfObject(
      args.config,
      ['labels', 'fontSize'],
      ['feature'],
    )
    const fontWidth = fontHeight * 0.75
    const shouldShowName = /\S/.test(name)
    const shouldShowDescription = /\S/.test(description)
    const textVerticalPadding = 2
    if (shouldShowName) {
      rootLayout.addChild(
        'nameLabel',
        0,
        rootLayout.getSubRecord('feature').bottom + textVerticalPadding,
        name.length * fontWidth,
        fontHeight,
      )
    }
    if (shouldShowDescription) {
      rootLayout.addChild(
        'descriptionLabel',
        0,
        rootLayout.getSubRecord(shouldShowName ? 'nameLabel' : 'feature')
          .bottom + textVerticalPadding,
        description.length * fontWidth,
        fontHeight,
      )
    }

    const topPx = layout.addRect(
      feature.id(),
      rootLayout.left,
      rootLayout.right,
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
          >
            {description}
          </Label>
        )}
      </g>
    )
  }
}

export default observer(Box)
