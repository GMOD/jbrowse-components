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
  } = rootModel as AppRootModel

  return (
    <>
      {isAssemblyEditing ? (
        <AssemblyManager
          rootModel={rootModel}
          onClose={() => setAssemblyEditing(false)}
        />
      ) : null}
      {isDefaultSessionEditing ? (
        <SetDefaultSession
          rootModel={rootModel}
          onClose={() => setDefaultSessionEditing(false)}
        />
      ) : null}
    </>
  )
}

export default observer(AdminComponent)
