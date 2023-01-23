import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'

// jbrowse
import { getConf } from '@jbrowse/core/configuration'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import PluginManager from '@jbrowse/core/PluginManager'
import { AssemblyManager } from '@jbrowse/plugin-data-management'

// styles
import './JBrowse.css'

// locals
import { RootModel } from './rootModel'

const JBrowse = observer(function ({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const { rootModel } = pluginManager
  return rootModel ? (
    <JBrowseNonNullRoot rootModel={rootModel as RootModel} />
  ) : null
})

const JBrowseNonNullRoot = observer(function ({
  rootModel,
}: {
  rootModel: RootModel
}) {
  const { session, jbrowse, error, isAssemblyEditing, setAssemblyEditing } =
    rootModel

  if (error) {
    throw error
  }

  const theme = getConf(jbrowse, 'theme')
  return (
    <ThemeProvider theme={createJBrowseTheme(theme, session?.themeName)}>
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

export default JBrowse
