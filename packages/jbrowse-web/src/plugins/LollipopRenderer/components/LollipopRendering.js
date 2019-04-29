import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { withStyles } from '@material-ui/core'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'

import { bpToPx } from '@gmod/jbrowse-core/util'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import Lollipop from './Lollipop'
import Stick from './Stick'

const styles = (/* theme */) => ({})

class LollipopRendering extends Component {
  static propTypes = {
    layout: ReactPropTypes.shape({
      add: ReactPropTypes.func.isRequired,
      getTotalHeight: ReactPropTypes.func.isRequired,
    }).isRequired,

    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,
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

  static defaultProps = {
    horizontallyFlipped: false,

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
    const { feature, bpPerPx, region, layout, horizontallyFlipped } = args

    const centerBp = Math.abs(feature.get('end') + feature.get('start')) / 2
    const centerPx = bpToPx(centerBp, region, bpPerPx, horizontallyFlipped)
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
      region,
      bpPerPx,
      layout,
      horizontallyFlipped,
      config,
      features,
      trackModel: { selectedFeatureId },
    } = this.props

    const sticksRendered = []
    const lollipopsRendered = []
    for (const feature of features.values()) {
      this.layout({
        feature,
        horizontallyFlipped,
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
export default withStyles(styles)(observer(LollipopRendering))
