import React from 'react'
import type PluginManager from '@jbrowse/core/PluginManager'
import { AppRootModel } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import {
  AssemblyManager,
  SetDefaultSession,
} from '@jbrowse/plugin-data-management'

interface JBrowse {
  defaultSession: {
    name: string
  }
}

function AdminComponent({ pluginManager }: { pluginManager: PluginManager }) {
  const { rootModel } = pluginManager

  const {
    isAssemblyEditing,
    isDefaultSessionEditing,
    setDefaultSessionEditing,
    setAssemblyEditing,
    jbrowse,
  } = rootModel as AppRootModel

  return (
    <>
      {isAssemblyEditing ? (
        <AssemblyManager
          rootModel={rootModel}
          onClose={() => {
            setAssemblyEditing(false)
          }}
        />
      ) : null}
      <SetDefaultSession
        rootModel={rootModel}
        open={isDefaultSessionEditing}
        onClose={() => {
          setDefaultSessionEditing(false)
        }}
        currentDefault={(jbrowse as JBrowse).defaultSession.name}
      />
    </>
  )
}

export default observer(AdminComponent)
