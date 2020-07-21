import { ConfigurationEditor } from '@gmod/jbrowse-plugin-config'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

function ConfigureConnection(props) {
  const { connectionType, model, setModelReady } = props
  const ConfigEditorComponent =
    connectionType.configEditorComponent || ConfigurationEditor

  return (
    <ConfigEditorComponent
      model={{ target: model }}
      setModelReady={setModelReady}
    />
  )
}

ConfigureConnection.propTypes = {
  connectionType: PropTypes.shape().isRequired,
  model: MobxPropTypes.observableObject.isRequired,
  setModelReady: PropTypes.func.isRequired,
}

export default observer(ConfigureConnection)
