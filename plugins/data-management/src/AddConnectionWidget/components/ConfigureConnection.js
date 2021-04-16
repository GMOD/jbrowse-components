import React, { Suspense } from 'react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { observer } from 'mobx-react'

const ConfigureConnection = observer(props => {
  const { connectionType, model, setModelReady } = props
  const ConfigEditorComponent =
    connectionType.configEditorComponent || ConfigurationEditor

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigEditorComponent
        model={{ target: model }}
        setModelReady={setModelReady}
      />
    </Suspense>
  )
})

export default ConfigureConnection
