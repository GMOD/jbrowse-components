import { ConfigurationEditor } from '@gmod/jbrowse-plugin-config'
import { observer } from 'mobx-react-lite'
import React from 'react'

function ConfigureConnection(props) {
  const { connectionType, model } = props
  const ConfigEditorComponent =
    connectionType.configEditorComponent || ConfigurationEditor

  return <ConfigEditorComponent model={{ target: model }} />
}

export default observer(ConfigureConnection)
