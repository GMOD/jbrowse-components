import { Suspense } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

// a custom configEditorComponent can derive the session from its MST `model`
// via getSession, so no session prop is plumbed through here
const ConfigureConnection = observer(function ConfigureConnection({
  connectionType,
  model,
}: {
  connectionType: ConnectionType
  model: AnyConfigurationModel
}) {
  const ConfigEditorComponent =
    connectionType.configEditorComponent ?? ConfigurationEditor

  return (
    <Suspense fallback={<LoadingEllipses />}>
      <ConfigEditorComponent model={{ target: model }} />
    </Suspense>
  )
})

export default ConfigureConnection
