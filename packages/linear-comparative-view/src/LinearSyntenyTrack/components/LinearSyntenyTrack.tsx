import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import { LinearSyntenyTrackStateModel } from '..'

const LinearSyntenyTrack: React.FC<{
  model: Instance<LinearSyntenyTrackStateModel>
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
LinearSyntenyTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

LinearSyntenyTrack.defaultProps = {
  children: null,
}
export default observer(LinearSyntenyTrack)
