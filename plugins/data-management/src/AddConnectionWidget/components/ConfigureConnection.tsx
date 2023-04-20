import React, { Suspense } from 'react'
import type { Instance } from 'mobx-state-tree'
import type baseConnectionConfig from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import { observer } from 'mobx-react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { LoadingEllipses } from '@jbrowse/core/ui'

export default observer(function ({
  connectionType,
  model,
  session,
}: {
  connectionType: ConnectionType
  model: Instance<typeof baseConnectionConfig>
  session: AbstractSessionModel
}) {
  return (
    <Suspense fallback={<LoadingEllipses />}>
      {connectionType.configEditorComponent ? (
        <connectionType.configEditorComponent
          connectionConfiguration={model}
          session={session}
        />
      ) : (
        <ConfigurationEditor model={{ target: model }} session={session} />
      )}
    </Suspense>
  )
})
