import { useEffect } from 'react'

import { App } from '@jbrowse/app-core'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { observer } from 'mobx-react'

import type { DesktopRootModel } from '../rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const JBrowseNonNullRoot = observer(function JBrowseNonNullRoot({
  rootModel,
}: {
  rootModel: DesktopRootModel
}) {
  const { session, error } = rootModel

  // Publish the live models the way jbrowse-web does. Read by the console, by
  // ErrorMessageStackTraceDialog (which puts the version and rpc driver in a bug
  // report and found nothing here before), and by the screenshot harness, which
  // can now assert on the model rather than on rendered header text.
  useEffect(() => {
    window.JBrowseRootModel = rootModel
    window.JBrowseSession = session
  }, [rootModel, session])

  if (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error
  }

  return session ? (
    <ThemeProvider theme={session.theme}>
      <CssBaseline />
      {/* key forces React to remount App when session changes (e.g.
          duplicate session) preventing stale references to old session views */}
      <App key={session.id} session={session} />
    </ThemeProvider>
  ) : null
})

const JBrowse = observer(function JBrowse({
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
