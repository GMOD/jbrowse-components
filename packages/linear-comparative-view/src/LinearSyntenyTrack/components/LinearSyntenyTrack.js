import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

function LinearSyntenyTrackRendering() {
  return null
}

function LinearSyntenyTrack(props) {
  const { model, children } = props
  return (
    <>
      {model.modelMessageComponent ? (
        <model.modelMessageComponent model={model} />
      ) : (
        <LinearSyntenyTrackRendering {...props} />
      )}
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
