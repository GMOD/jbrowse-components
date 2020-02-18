import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import LinearComparativeConnections from './LinearComparativeConnections'

function LinearComparativeTrack(props) {
  const { track, children } = props
  return (
    <>
      {track.trackMessageComponent ? (
        <track.trackMessageComponent model={track} />
      ) : (
        <LinearComparativeConnections {...props} />
      )}
      {children}
    </>
  )
}
LinearComparativeTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  track: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.node,
}

LinearComparativeTrack.defaultProps = {
  children: null,
}
export default observer(LinearComparativeTrack)
