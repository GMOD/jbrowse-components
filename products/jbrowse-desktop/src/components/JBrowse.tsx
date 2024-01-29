import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'

// jbrowse
import { App } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { AssemblyManager } from '@jbrowse/plugin-data-management'

// locals
import { DesktopRootModel } from '../rootModel'

const JBrowseNonNullRoot = observer(function ({
  rootModel,
}: {
  rootModel: DesktopRootModel
}) {
  const { session, error, isAssemblyEditing, setAssemblyEditing } = rootModel

  if (error) {
    throw error
  }
  if (!session) {
    return null
  }

  return (
    <ThemeProvider theme={session.theme}>
      <CssBaseline />
      {session ? (
        <>
          <App session={session} />
          <Suspense fallback={null}>
            {isAssemblyEditing ? (
              <AssemblyManager
                rootModel={rootModel}
                onClose={() => setAssemblyEditing(false)}
              />
            ) : null}
          </Suspense>
        </>
      ) : (
        <div>No session</div>
      )}
    </ThemeProvider>
  )
})

const JBrowse = observer(function ({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const { rootModel } = pluginManager
  return rootModel ? (
    <JBrowseNonNullRoot rootModel={rootModel as DesktopRootModel} />
  ) : null
})

export default JBrowse
