import { getConf } from '@gmod/jbrowse-core/configuration'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import LinearSyntenyConnections from './LinearSyntenyConnections'

function Overlay() {
  return <> </>
}

function LinearSyntenyTrack(props) {
  const { model, children } = props
  return (
    <>
      {model.trackMessageComponent ? (
        <model.trackMessageComponent model={model} />
      ) : (
        <LinearSyntenyConnections {...props} />
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
