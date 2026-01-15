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
