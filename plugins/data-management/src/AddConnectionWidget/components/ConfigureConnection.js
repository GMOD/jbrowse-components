import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { observer } from 'mobx-react'
import React from 'react'

export default observer(props => {
  const { connectionType, model, setModelReady } = props
  const ConfigEditorComponent =
    connectionType.configEditorComponent || ConfigurationEditor

  return (
    <ConfigEditorComponent
      model={{ target: model }}
      setModelReady={setModelReady}
    />
  )
})
