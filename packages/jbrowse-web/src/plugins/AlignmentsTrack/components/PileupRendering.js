import React from 'react'
import { observer } from 'mobx-react'

import './PileupRendering.scss'

const PileupRendering = observer(({ data }) => (
  <div className="PileupRendering">{data.length} features</div>
))

export default PileupRendering
