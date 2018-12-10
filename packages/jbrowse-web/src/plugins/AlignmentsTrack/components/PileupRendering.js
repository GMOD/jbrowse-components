import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import SsrCanvas from './SsrCanvas'

const layoutFeature = ({
  feature,
  layout,
  bpPerPx,
  region,
  horizontallyFlipped = false,
}) => {
  if (horizontallyFlipped)
    throw new Error('horizontallyFlipped not yet supported')
  const leftBase = region.start
  const startPx = (feature.get('start') - leftBase) / bpPerPx
  const endPx = (feature.get('end') - leftBase) / bpPerPx
  const topPx = layout.addRect(
    feature.id(),
    feature.get('start'),
    feature.get('end'),
    10, // height
    feature,
  )

  return {
    feature,
    startPx,
    endPx,
    topPx,
  }
}

//     return (
//       <div
//         className="feature"
//         data-feature-id={feature.id()}
//         style={{
//           position: 'absolute',
//           left: `${startPx}px`,
//           width: `${endPx - startPx}px`,
//           top: `${top}px`,
//         }}
//       >
//         {feature.id()}
//       </div>
//     )
//   },
// )

@observer
class PileupRendering extends Component {
  static propTypes = {
    features: PropTypes.arrayOrObservableArrayOf(
      PropTypes.objectOrObservableObject,
    ).isRequired,
    layout: PropTypes.objectOrObservableObject.isRequired,
    region: PropTypes.objectOrObservableObject.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
  }

  render() {
    const { features, layout, region, bpPerPx } = this.props
    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) throw new Error('invalid layout')
    const rects = features.map(feature =>
      layoutFeature({
        region,
        bpPerPx,
        feature,
        layout,
      }),
    )
    const imageData = 'foo'
    return (
      <div className="PileupRendering">
        <SsrCanvas width={640} height={480} imageData={imageData} />
      </div>
    )
  }
}
export default PileupRendering
