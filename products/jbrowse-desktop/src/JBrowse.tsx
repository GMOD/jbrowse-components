import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'

// jbrowse
import { App } from '@jbrowse/core/ui'
import PluginManager from '@jbrowse/core/PluginManager'
import { AssemblyManager } from '@jbrowse/plugin-data-management'

// locals
import { RootModel } from './rootModel'

const JBrowseNonNullRoot = observer(function ({
  rootModel,
}: {
  rootModel: RootModel
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
          <Suspense fallback={<div />}>
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

export default observer(function ({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const { rootModel } = pluginManager
  return rootModel ? (
    <JBrowseNonNullRoot rootModel={rootModel as RootModel} />
  ) : null
})
