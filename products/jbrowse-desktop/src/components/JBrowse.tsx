import React from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'

// jbrowse
import { App } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { DesktopRootModel } from '../rootModel'

const JBrowseNonNullRoot = observer(function ({
  rootModel,
}: {
  rootModel: DesktopRootModel
}) {
  const { session, error } = rootModel

  if (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error
  }

  return session ? (
    <ThemeProvider theme={session.theme}>
      <CssBaseline />
      <App session={session} />
    </ThemeProvider>
  ) : null
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
