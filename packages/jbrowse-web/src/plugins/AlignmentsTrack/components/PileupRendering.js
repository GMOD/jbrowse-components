import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'

@observer
class PileupRendering extends Component {
  render() {
    return (
      <div className="PileupRendering">
        <PrerenderedCanvas {...this.props} />
      </div>
    )
  }
}
export default PileupRendering
