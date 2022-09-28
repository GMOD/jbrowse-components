import React, { Suspense } from 'react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { observer } from 'mobx-react'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ConfigureConnection = observer(
  (props: { connectionType: ConnectionType; model: AnyConfigurationModel }) => {
    const { connectionType, model } = props
    const ConfigEditorComponent =
      connectionType.configEditorComponent || ConfigurationEditor

    return (
      <Suspense fallback={<div>Loading...</div>}>
        <ConfigEditorComponent model={{ target: model }} />
      </Suspense>
    )
  },
)

export default ConfigureConnection
