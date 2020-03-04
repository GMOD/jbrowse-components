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
  const { syntenyBlocks } = model
  return (
    <>
      <syntenyBlocks.ReactComponent {...props} />
      {children}
    </>
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
