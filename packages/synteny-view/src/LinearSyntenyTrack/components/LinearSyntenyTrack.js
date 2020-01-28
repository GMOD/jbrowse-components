import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import LinearSyntenyConnections from './LinearSyntenyConnections'

function LinearSyntenyTrack(props) {
  const { track, children } = props
  return (
    <>
      {track.trackMessageComponent ? (
        <track.trackMessageComponent model={track} />
      ) : (
        <LinearSyntenyConnections {...props} />
      )}
      {children}
    </>
  )
}
LinearSyntenyTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  track: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.node,
}

LinearSyntenyTrack.defaultProps = {
  children: null,
}
export default observer(LinearSyntenyTrack)
