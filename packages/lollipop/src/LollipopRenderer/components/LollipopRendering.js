import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { bpToPx } from '@gmod/jbrowse-core/util'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import Lollipop from './Lollipop'
import Stick from './Stick'

class LollipopRendering extends Component {
  onMouseDown = event => {
    const { onMouseDown: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  onMouseUp = event => {
    const { onMouseUp: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  onMouseEnter = event => {
    const { onMouseEnter: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  onMouseLeave = event => {
    const { onMouseLeave: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  onMouseOver = event => {
    const { onMouseOver: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  onMouseOut = event => {
    const { onMouseOut: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  onClick = event => {
    const { onClick: handler } = this.props
    if (!handler) return undefined
    return handler(event)
  }

  layout(args) {
    const { feature, bpPerPx, region, layout } = args

    const centerBp = Math.abs(feature.get('end') + feature.get('start')) / 2
    const centerPx = bpToPx(centerBp, region, bpPerPx)
    const radiusPx = readConfObject(args.config, 'radius', [feature])

    if (!radiusPx)
      console.error(
        new Error(
          `lollipop radius ${radiusPx} configured for feature ${feature.id()}`,
        ),
      )
    layout.add(feature.id(), centerPx, radiusPx * 2, radiusPx * 2, {
      featureId: feature.id(),
      anchorX: centerPx,
      radiusPx,
      score: readConfObject(args.config, 'score', [feature]),
    })
  }

  render() {
    const {
      regions,
      bpPerPx,
      layout,
      config,
      features,
      trackModel: { selectedFeatureId },
    } = this.props

    const [region] = regions
    const sticksRendered = []
    const lollipopsRendered = []
    for (const feature of features.values()) {
      this.layout({
        feature,
        bpPerPx,
        region,
        config,
        layout,
      })
    }

    for (const layoutRecord of layout.getLayout(config).values()) {
      const feature = features.get(layoutRecord.data.featureId)
      lollipopsRendered.push(
        <Stick
          {...this.props}
          layoutRecord={layoutRecord}
          feature={feature}
          key={`stick-${feature.id()}`}
          selectedFeatureId={selectedFeatureId}
        />,
      )
    }

    for (const layoutRecord of layout.getLayout(config).values()) {
      const feature = features.get(layoutRecord.data.featureId)
      lollipopsRendered.push(
        <Lollipop
          {...this.props}
          layoutRecord={layoutRecord}
          feature={feature}
          key={`body-${feature.id()}`}
          selectedFeatureId={selectedFeatureId}
        />,
      )
    }

    const width = (region.end - region.start) / bpPerPx
    const height = layout.getTotalHeight()

    return (
      <svg
        className="LollipopRendering"
        width={width}
        height={height}
        style={{
          position: 'relative',
        }}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onMouseOver={this.onMouseOver}
        onMouseOut={this.onMouseOut}
        onFocus={this.onMouseEnter}
        onBlur={this.onMouseLeave}
        onClick={this.onClick}
      >
        {sticksRendered}
        {lollipopsRendered}
      </svg>
    )
  }
}

LollipopRendering.propTypes = {
  layout: ReactPropTypes.shape({
    getLayout: ReactPropTypes.func.isRequired,
    add: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,

  regions: ReactPropTypes.arrayOf(CommonPropTypes.Region).isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  features: ReactPropTypes.instanceOf(Map),
  config: CommonPropTypes.ConfigSchema.isRequired,
  trackModel: ReactPropTypes.shape({
    /** id of the currently selected feature, if any */
    selectedFeatureId: ReactPropTypes.string,
  }),

  onMouseDown: ReactPropTypes.func,
  onMouseUp: ReactPropTypes.func,
  onMouseEnter: ReactPropTypes.func,
  onMouseLeave: ReactPropTypes.func,
  onMouseOver: ReactPropTypes.func,
  onMouseOut: ReactPropTypes.func,
  onClick: ReactPropTypes.func,
}

LollipopRendering.defaultProps = {
  trackModel: {},

  features: new Map(),

  onMouseDown: undefined,
  onMouseUp: undefined,
  onMouseEnter: undefined,
  onMouseLeave: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onClick: undefined,
}

export default observer(LollipopRendering)
