import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'

function Feature({ feature, layout, bpPerPx, region, flipped }) {
  // const leftBase = region.start
  // const startbp = fRect.l * bpPerPx + leftBase
  // const endbp = (fRect.l + fRect.w) * bpPerPx + leftBase
  // const top = layout.addRect(feature.id(), startbp, endbp, fRect.h, feature)

  return <div className="feature" data-feature-id={feature.id()} style={{}} />
}

Feature.propTypes = {
  feature: PropTypes.objectOrObservableObject.isRequired,
  layout: PropTypes.objectOrObservableObject.isRequired,
  region: PropTypes.objectOrObservableObject.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  flipped: PropTypes.boolean,
}

Feature.defaultProps = { flipped: false }

@observer
class PileupRendering extends Component {
  static propTypes = {
    data: PropTypes.arrayOrObservableArrayOf(PropTypes.objectOrObservableObject)
      .isRequired,
    layout: PropTypes.objectOrObservableObject.isRequired,
    region: PropTypes.objectOrObservableObject.isRequired,
  }

  render() {
    const { data: features } = this.props
    return (
      <div className="PileupRendering">
        {features.map(feature => (
          <Feature key={feature.id()} feature={feature} {...this.props} />
        ))}
      </div>
    )
  }
}
export default PileupRendering
