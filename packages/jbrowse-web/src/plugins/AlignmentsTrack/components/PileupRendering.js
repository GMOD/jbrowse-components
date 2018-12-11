import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

const layoutPropType = ReactPropTypes.shape({
  getRectangles: ReactPropTypes.func.isRequired,
})

@observer
class PileupRendering extends Component {
  static propTypes = {
    layout: layoutPropType.isRequired,
  }

  render() {
    const { layout } = this.props
    return (
      <div className="PileupRendering">
        <PrerenderedCanvas {...this.props} />
      </div>
    )
  }
}
export default PileupRendering
