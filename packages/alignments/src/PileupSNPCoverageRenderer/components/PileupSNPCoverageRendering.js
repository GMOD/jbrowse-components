import { observer } from 'mobx-react'
import React from 'react'
import ReactPropTypes from 'prop-types'

function PileupSNPCoverageRendering({ children }) {
  console.log(children)
  return <div>{children}</div> // correct information but error is
  // Warning: Did not expect server HTML to contain a <div> in <div>.
  // in div (at PileupSNPCoverageRendering.js:6)
  // in PileupSNPCoverageRendering
}

PileupSNPCoverageRendering.propTypes = {
  children: ReactPropTypes.array,
}

PileupSNPCoverageRendering.defaultProps = {
  children: [],
}

export default observer(PileupSNPCoverageRendering)
