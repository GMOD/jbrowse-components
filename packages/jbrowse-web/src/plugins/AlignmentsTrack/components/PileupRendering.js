import React, { Component } from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './PileupRendering.scss'
import PrerenderedCanvas from './PrerenderedCanvas'
import PrecomputedLayout from '../../../util/PrecomputedLayout'

const layoutPropType = ReactPropTypes.shape({
  getRectangles: ReactPropTypes.func.isRequired,
})

function ImageMapFromPrecomputedLayout({ layout }) {
  return (
    <map>
      {Object.entries(layout.getRectangles()).map(([featureId, coords]) => {
        if (!coords.join) debugger
        return (
          <area
            key={featureId}
            alt={`feature ${featureId}`}
            shape="rect"
            coords={coords.join(',')}
          />
        )
      })}
    </map>
  )
}
ImageMapFromPrecomputedLayout.propTypes = {
  layout: layoutPropType.isRequired,
}

@observer
class PileupRendering extends Component {
  static propTypes = {
    layout: layoutPropType.isRequired,
  }

  render() {
    const { layout } = this.props
    return (
      <div className="PileupRendering">
        <ImageMapFromPrecomputedLayout layout={layout} />
        <PrerenderedCanvas {...this.props} />
      </div>
    )
  }
}
export default PileupRendering
