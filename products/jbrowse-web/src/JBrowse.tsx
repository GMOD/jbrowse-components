import React, { useEffect } from 'react'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import { useQueryParam, StringParam } from 'use-query-params'
import { CssBaseline, ThemeProvider } from '@material-ui/core'

// core
import { getConf } from '@jbrowse/core/configuration'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import ShareButton from './ShareButton'
import AdminComponent from './AdminComponent'
import { SessionModel } from './sessionModelFactory'

const JBrowse = observer(
  ({ pluginManager }: { pluginManager: PluginManager }) => {
    const [adminKey] = useQueryParam('adminKey', StringParam)
    const [adminServer] = useQueryParam('adminServer', StringParam)
    const [configPath] = useQueryParam('config', StringParam)
    const [, setSessionId] = useQueryParam('session', StringParam)
    const { rootModel } = pluginManager
    const { error, jbrowse } = rootModel || {}
    const session = rootModel?.session as SessionModel
    const currentSessionId = session.id

    useEffect(() => {
      setSessionId(`local-${currentSessionId}`)
      // @ts-ignore
      window.JBrowseRootModel = rootModel
      // @ts-ignore
      window.JBrowseSession = session
    }, [currentSessionId, rootModel, session, setSessionId])

    useEffect(() => {
      if (!jbrowse) {
        return
      }
      onSnapshot(jbrowse, async snapshot => {
        if (adminKey) {
          const response = await fetch(adminServer || `/updateConfig`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              adminKey,
              configPath,
              config: snapshot,
            }),
          })
          if (!response.ok) {
            const message = await response.text()
            if (session) {
              session.notify(
                `Admin server error: ${response.status} (${
                  response.statusText
                }) ${message || ''}`,
              )
            }
          }
        }
      })
    }, [jbrowse, session, adminKey, adminServer, configPath])

    if (error) {
      throw error
    }
    if (!rootModel) {
      throw new Error('No rootModel found')
    }
    if (!session) {
      throw new Error('No session found')
    }

    const theme = getConf(rootModel.jbrowse, 'theme')
    return (
      <ThemeProvider theme={createJBrowseTheme(theme)}>
        <CssBaseline />
        <App
          session={session}
          HeaderButtons={<ShareButton session={session} />}
        />
        {adminKey ? <AdminComponent pluginManager={pluginManager} /> : null}
      </ThemeProvider>
    )
  },
)

export default JBrowse
