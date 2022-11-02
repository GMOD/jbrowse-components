import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { LoadingEllipses } from '@jbrowse/core/ui'

const ConfigureConnection = observer(
  (props: {
    connectionType: ConnectionType
    model: AnyConfigurationModel
    session: AbstractSessionModel
  }) => {
    const { connectionType, model, session } = props
    const ConfigEditorComponent =
      connectionType.configEditorComponent || ConfigurationEditor

    return (
      <Suspense fallback={<LoadingEllipses />}>
        <ConfigEditorComponent model={{ target: model }} session={session} />
      </Suspense>
    )
  },
)

export default ConfigureConnection
