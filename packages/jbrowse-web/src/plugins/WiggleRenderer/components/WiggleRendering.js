import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './WiggleRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { bpToPx } from '../../../util'

const layoutPropType = ReactPropTypes.shape({
  getRectangles: ReactPropTypes.func.isRequired,
})

@observer
class WiggleRendering extends Component {
  static propTypes = {
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,

    trackModel: ReactPropTypes.shape({}),
  }

  static defaultProps = {
    horizontallyFlipped: false,

    trackModel: {},
  }

  render() {
    const { width, height } = this.props
    const canvasWidth = Math.ceil(width)
    // need to call this in render so we get the right observer behavior
    return (
      <div className="WiggleRendering" style={{ position: 'relative' }}>
        <PrerenderedCanvas {...this.props} width={canvasWidth} />
      </div>
    )
  }
}

export default WiggleRendering
// import React from 'react'
// import { observer } from 'mobx-react'
// import ReactPropTypes from 'prop-types'
//
// import './WiggleRendering.scss'
//
// import { PropTypes as CommonPropTypes } from '../../../mst-types'
// import { readConfObject } from '../../../configuration'
//
// function WiggleRendering(props) {
//   console.log('here')
//   const { bpPerPx, config } = props
//   const height = readConfObject(config, 'height')
//   return (
//     <div
//       className="WiggleRendering"
//       style={{ height: `${height}px`, fontSize: `${height * 0.8}px` }}
//     >
//       <p>Hello world!</p>
//     </div>
//   )
// }
// WiggleRendering.propTypes = {
//   config: CommonPropTypes.ConfigSchema.isRequired,
//   bpPerPx: ReactPropTypes.number.isRequired,
// }
//
// export default observer(WiggleRendering)
