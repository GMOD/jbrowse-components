import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import { BreakpointSplitTrackStateModel } from '..'

type BSV = Instance<BreakpointSplitTrackStateModel>

const BreakpointSplitTrack: React.FC<{
  model: BSV
  children?: React.ReactNode
}> = props => {
  const { model, children } = props
  return (
    <div
      style={{
        height: model.renderProps.height,
        width: model.renderProps.width,
      }}
    >
      <model.ReactComponent2 {...props} />
      {children}
    </div>
  )
}
BreakpointSplitTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

BreakpointSplitTrack.defaultProps = {
  children: null,
}
export default observer(BreakpointSplitTrack)
