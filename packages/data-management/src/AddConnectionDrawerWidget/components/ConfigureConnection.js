import { ConfigurationEditor } from '@gmod/jbrowse-plugin-config'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import PropTypes from 'prop-types'
import React from 'react'

function ConfigureConnection(props) {
  const { connectionType, model } = props
  const ConfigEditorComponent =
    connectionType.configEditorComponent || ConfigurationEditor

  return <ConfigEditorComponent model={{ target: model }} />
}

ConfigureConnection.propTypes = {
  connectionType: PropTypes.string.isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ConfigureConnection)
