import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import PrecomputedLayout from '../../../util/PrecomputedLayout'

const Feature = observer(
  ({ feature, layout, bpPerPx, region, horizontallyFlipped }) => {
    const leftBase = region.start
    const startPx = (feature.get('start') - leftBase) / bpPerPx
    const endPx = (feature.get('end') - leftBase) / bpPerPx
    const top = layout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('end'),
      17, // height
      feature,
    )

    return (
      <div
        className="feature"
        data-feature-id={feature.id()}
        style={{
          position: 'absolute',
          left: `${startPx}px`,
          width: `${endPx - startPx}px`,
          top: `${top}px`,
        }}
      >
        {feature.id()}
      </div>
    )
  },
)

Feature.propTypes = {
  feature: PropTypes.objectOrObservableObject.isRequired,
  layout: PropTypes.objectOrObservableObject.isRequired,
  region: PropTypes.objectOrObservableObject.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  horizontallyFlipped: ReactPropTypes.bool,
}

Feature.defaultProps = { horizontallyFlipped: false }

@observer
class PileupRendering extends Component {
  static propTypes = {
    features: PropTypes.arrayOrObservableArrayOf(
      PropTypes.objectOrObservableObject,
    ).isRequired,
    layout: PropTypes.objectOrObservableObject.isRequired,
    region: PropTypes.objectOrObservableObject.isRequired,
  }

  render() {
    const { features } = this.props
    let { layout } = this.props
    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) layout = new PrecomputedLayout(layout)
    return (
      <div className="PileupRendering">
        {features.map(feature => (
          <Feature
            {...this.props}
            key={feature.id()}
            layout={layout}
            feature={feature}
          />
        ))}
      </div>
    )
  }
}
export default PileupRendering
