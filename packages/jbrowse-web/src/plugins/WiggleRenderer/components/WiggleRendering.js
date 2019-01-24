import React from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './WiggleRendering.scss'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { readConfObject } from '../../../configuration'

function WiggleRendering(props) {
  console.log('here')
  const { bpPerPx, config } = props
  const height = readConfObject(config, 'height')
  return (
    <div
      className="WiggleRendering"
      style={{ height: `${height}px`, fontSize: `${height * 0.8}px` }}
    >
      <p>Hello world!</p>
    </div>
  )
}
WiggleRendering.propTypes = {
  config: CommonPropTypes.ConfigSchema.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
}

export default observer(WiggleRendering)
