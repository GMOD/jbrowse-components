import React, { Suspense } from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { observer } from 'mobx-react'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const ConfigureConnection = observer(function ({
  connectionType,
  model,
  session,
}: {
  connectionType: ConnectionType
  model: AnyConfigurationModel
  session: AbstractSessionModel
}) {
  const ConfigEditorComponent =
    connectionType.configEditorComponent || ConfigurationEditor

  return (
    <Suspense fallback={<LoadingEllipses />}>
      <ConfigEditorComponent model={{ target: model }} session={session} />
    </Suspense>
  )
})

export default ConfigureConnection
