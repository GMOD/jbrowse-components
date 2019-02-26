import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { withStyles } from '@material-ui/core'
import { PropTypes as CommonPropTypes } from '../../../mst-types'

import Lollipop from './Lollipop'

const styles = theme => ({})

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

  chooseGlyphComponent(/* feature */) {
    return Lollipop
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

    const featuresRendered = []
    for (const feature of features.values()) {
      const FeatureComponent = this.chooseGlyphComponent(feature)
      FeatureComponent.layout({
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
      const FeatureComponent = this.chooseGlyphComponent(feature)
      featuresRendered.push(
        <FeatureComponent
          {...this.props}
          layoutRecord={layoutRecord}
          feature={feature}
          key={feature.id()}
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
        {featuresRendered}
      </svg>
    )
  }
}
export default withStyles(styles)(observer(LollipopRendering))
