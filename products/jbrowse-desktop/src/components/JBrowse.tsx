import React from 'react'

// jbrowse
import { App } from '@jbrowse/app-core'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { observer } from 'mobx-react'

// locals
import type { DesktopRootModel } from '../rootModel'
import type PluginManager from '@jbrowse/core/PluginManager'

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
