import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './SvgFeatureRendering.scss'

import { PropTypes as CommonPropTypes } from '../../../mst-types'

import Box from './Box'

@observer
class SvgFeatureRendering extends Component {
  static propTypes = {
    layout: ReactPropTypes.shape({
      addRect: ReactPropTypes.func.isRequired,
      getTotalHeight: ReactPropTypes.func.isRequired,
    }).isRequired,
    // layoutRecords: ReactPropTypes.arrayOf(
    //   ReactPropTypes.shape({
    //     feature: ReactPropTypes.shape({ get: ReactPropTypes.func.isRequired }),
    //     startPx: ReactPropTypes.number.isRequired,
    //     endPx: ReactPropTypes.number.isRequired,
    //     topPx: ReactPropTypes.number.isRequired,
    //     heightPx: ReactPropTypes.number.isRequired,
    //   }),
    // ).isRequired,
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,
    features: ReactPropTypes.instanceOf(Map),
    config: CommonPropTypes.ConfigSchema.isRequired,
    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
    }),

    // onFeatureMouseDown: ReactPropTypes.func,
    // onFeatureMouseEnter: ReactPropTypes.func,
    // onFeatureMouseOut: ReactPropTypes.func,
    // onFeatureMouseOver: ReactPropTypes.func,
    // onFeatureMouseUp: ReactPropTypes.func,
    // onFeatureMouseLeave: ReactPropTypes.func,
    // onFeatureMouseMove: ReactPropTypes.func,

    // // synthesized from mouseup and mousedown
    // onFeatureClick: ReactPropTypes.func,

    // onMouseDown: ReactPropTypes.func,
    // onMouseUp: ReactPropTypes.func,
    // onMouseEnter: ReactPropTypes.func,
    // onMouseLeave: ReactPropTypes.func,
    // onMouseOver: ReactPropTypes.func,
    // onMouseOut: ReactPropTypes.func,
  }

  static defaultProps = {
    horizontallyFlipped: false,

    trackModel: {},

    features: new Map(),

    // onFeatureMouseDown: undefined,
    // onFeatureMouseEnter: undefined,
    // onFeatureMouseOut: undefined,
    // onFeatureMouseOver: undefined,
    // onFeatureMouseUp: undefined,
    // onFeatureMouseLeave: undefined,
    // onFeatureMouseMove: undefined,

    // onFeatureClick: undefined,

    // onMouseDown: undefined,
    // onMouseUp: undefined,
    // onMouseEnter: undefined,
    // onMouseLeave: undefined,
    // onMouseOver: undefined,
    // onMouseOut: undefined,
  }

  chooseGlyphComponent(feature) {
    return Box
  }

  render() {
    const {
      region,
      bpPerPx,
      layout,
      horizontallyFlipped,
      config,
      features,
    } = this.props

    const featuresRendered = []
    for (const feature of features.values()) {
      const FeatureComponent = this.chooseGlyphComponent(feature)
      const layoutRecord = FeatureComponent.layout({
        feature,
        horizontallyFlipped,
        bpPerPx,
        region,
        config,
        layout,
      })
      featuresRendered.push(
        <FeatureComponent
          {...this.props}
          layoutRecord={layoutRecord}
          feature={feature}
          key={feature.id()}
        />,
      )
    }

    const width = (region.end - region.start) / bpPerPx
    const height = layout.getTotalHeight()

    return (
      <svg
        className="SvgFeatureRendering"
        width={`${width}px`}
        height={`${height}px`}
        style={{
          position: 'relative',
        }}
      >
        {featuresRendered}
      </svg>
    )
  }
}
export default SvgFeatureRendering
