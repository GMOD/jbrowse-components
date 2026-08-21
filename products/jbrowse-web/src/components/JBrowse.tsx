import { useEffect, useState } from 'react'

import { App, readQueryParams, setQueryParams } from '@jbrowse/app-core'
import { StyleThemeProvider } from '@jbrowse/core/ui/PaletteContext'
import { onSnapshot } from '@jbrowse/mobx-state-tree'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import { clearCrashedSession } from '../crashedSession.ts'
import FileHandleRestoreBanner from './FileHandleRestoreBanner.tsx'
import ShareButton from './ShareButton.tsx'
import { adminServerErrorMessage } from './adminServerError.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const JBrowse = observer(function JBrowse({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const [{ adminKey, adminServer, config: configPath }] = useState(() =>
    readQueryParams(['adminKey', 'adminServer', 'config']),
  )
  const { rootModel } = pluginManager
  const { error, jbrowse, session: s } = rootModel!
  const session = s as WebSessionModel
  const { id, theme, styleTheme } = session

  useEffect(() => {
    setQueryParams({ session: `local-${id}` })
    // ...and this is "far enough to be called a successful boot". React runs a
    // parent's effects after its children's, so reaching here means the whole
    // app tree below rendered and committed without reaching the app-level
    // ErrorBoundary — the first moment that is true.
    //
    // Earlier is worthless: the plugin manager being built and the session
    // being applied are both points the crash we mark happens *after*, and
    // createPluginManager already catches its own throws into
    // pluginManagerError. Later (a timer, a first interaction) would leave the
    // offer standing over a boot that is plainly fine. Clearing at the first
    // success costs nothing even for a crash that arrives seconds in, or out of
    // a lazily-loaded view chunk that lands after this commit: the boundary
    // writes the marker again, always after this ran.
    clearCrashedSession()
    window.JBrowseRootModel = rootModel
    window.JBrowseSession = session
  }, [id, rootModel, session])

  useEffect(() => {
    return adminKey
      ? onSnapshot(jbrowse, async snapshot => {
          try {
            const response = await fetch(adminServer || '/updateConfig', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adminKey,
                configPath,
                config: snapshot,
              }),
            })
            if (!response.ok) {
              throw new Error(
                adminServerErrorMessage(
                  response.status,
                  response.statusText,
                  await response.text(),
                ),
              )
            }
          } catch (e) {
            session.notify(`Admin server error: ${e}`)
          }
        })
      : undefined
  }, [jbrowse, session, adminKey, adminServer, configPath])

  if (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error
  }

  return (
    <ThemeProvider theme={theme}>
      <StyleThemeProvider theme={styleTheme}>
        <CssBaseline />
        <FileHandleRestoreBanner session={session} />
        {/* key={id} forces React to remount App when session changes (e.g.
          duplicate session) preventing stale references to old session views */}
        <App
          key={id}
          session={session}
          HeaderButtons={<ShareButton session={session} />}
        />
      </StyleThemeProvider>
    </ThemeProvider>
  )
})

export default JBrowse
