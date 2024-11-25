import React, { useEffect } from 'react'
import { App } from '@jbrowse/app-core'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import { useQueryParam, StringParam } from 'use-query-params'

// core

// locals
import ShareButton from './ShareButton'
import type { WebSessionModel } from '../sessionModel'
import type PluginManager from '@jbrowse/core/PluginManager'

const JBrowse = observer(function ({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const [adminKey] = useQueryParam('adminKey', StringParam)
  const [adminServer] = useQueryParam('adminServer', StringParam)
  const [configPath] = useQueryParam('config', StringParam)
  const [, setSessionId] = useQueryParam('session', StringParam)
  const { rootModel } = pluginManager
  const { error, jbrowse } = rootModel || {}
  const session = rootModel?.session as WebSessionModel | undefined
  const currentSessionId = session?.id

  useEffect(() => {
    setSessionId(`local-${currentSessionId}`, 'replaceIn')
    // @ts-expect-error
    window.JBrowseRootModel = rootModel
    // @ts-expect-error
    window.JBrowseSession = session
  }, [currentSessionId, rootModel, session, setSessionId])

  useEffect(() => {
    if (!jbrowse || !adminKey) {
      return
    }
    return onSnapshot(jbrowse, async snapshot => {
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
        session?.notify(`Admin server error: ${e}`)
      }
    })
  }, [jbrowse, session, adminKey, adminServer, configPath])

  if (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error
  }
  if (!rootModel) {
    throw new Error('No rootModel found')
  }
  if (!session) {
    throw new Error('No session found')
  }

  return (
    <ThemeProvider theme={session.theme}>
      <CssBaseline />
      <App
        // @ts-expect-error see comments on interface for AbstractSessionModel
        session={session}
        HeaderButtons={<ShareButton session={session} />}
      />
    </ThemeProvider>
  )
})

export default JBrowse
