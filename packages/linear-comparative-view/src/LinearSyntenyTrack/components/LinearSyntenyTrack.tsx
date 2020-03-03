import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'


function LinearSyntenyTrack(props) {
  const { model, children } = props
  const {syntenyBlocks} = model
  return (
    <>
        <syntenyBlocks.ReactComponent {...props} />
      {children}
    </>
  )
}
LinearSyntenyTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.node,
}

LinearSyntenyTrack.defaultProps = {
  children: null,
}
export default observer(LinearSyntenyTrack)
