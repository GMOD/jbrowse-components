import React from 'react'
import type PluginManager from '@jbrowse/core/PluginManager'
import { AppRootModel } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import {
  AssemblyManager,
  SetDefaultSession,
} from '@jbrowse/plugin-data-management'

function AdminComponent({ pluginManager }: { pluginManager: PluginManager }) {
  const { rootModel } = pluginManager

  const {
    isAssemblyEditing,
    isDefaultSessionEditing,
    setDefaultSessionEditing,
    setAssemblyEditing,
    session,
  } = rootModel as AppRootModel

  return session ? (
    <>
      {isAssemblyEditing ? (
        <AssemblyManager
          session={session}
          onClose={() => setAssemblyEditing(false)}
        />
      ) : null}
      <SetDefaultSession
        session={session}
        open={isDefaultSessionEditing}
        onClose={() => setDefaultSessionEditing(false)}
      />
    </>
  ) : null
}

export default observer(AdminComponent)
