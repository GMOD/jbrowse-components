import { useEffect } from 'react'

import { App } from '@jbrowse/app-core'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'

import ShareButton from './ShareButton'
import { readQueryParams, setQueryParams } from '../useQueryParam'

import type { WebSessionModel } from '../sessionModel'
import type PluginManager from '@jbrowse/core/PluginManager'

const JBrowse = observer(function ({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const {
    adminKey,
    adminServer,
    config: configPath,
  } = readQueryParams(['adminKey', 'adminServer', 'config'])
  const { rootModel } = pluginManager
  const { error, jbrowse, session: s } = rootModel!
  const session = s as WebSessionModel
  const { id, theme } = session

  useEffect(() => {
    setQueryParams({ session: `local-${id}` })
    // @ts-expect-error
    window.JBrowseRootModel = rootModel
    // @ts-expect-error
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
              const message = await response.text()
              throw new Error(`HTTP ${response.status} (${message})`)
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
      <CssBaseline />
      <App
        // @ts-expect-error
        session={session}
        HeaderButtons={<ShareButton session={session} />}
      />
    </ThemeProvider>
  )
})

export default JBrowse
