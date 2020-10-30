import React, { useEffect, useState } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { useQueryParam, StringParam } from 'use-query-params'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import ShareButton from './ShareButton'
// import StartScreen from './StartScreen'
// import factoryReset from './factoryReset'

function deleteBaseUris(config) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        deleteBaseUris(config[key])
      } else if (key === 'uri') {
        delete config.baseUri
      }
    }
  }
}

const JBrowse = observer(({ pluginManager }) => {
  const [adminKey] = useQueryParam('adminKey', StringParam)
  const [, setSessionId] = useQueryParam('session', StringParam)
  const [firstLoad, setFirstLoad] = useState(true)

  const { rootModel } = pluginManager
  const { error, jbrowse, session } = rootModel || {}
  const { id: currentSessionId } = session
  if (firstLoad && session) setFirstLoad(false)

  console.log('pm', pluginManager)
  console.log('rootModel', pluginManager.rootModel)
  console.log('session', pluginManager.rootModel.session)

  useEffect(() => {
    setSessionId(`local-${currentSessionId}`)
  }, [currentSessionId, setSessionId])

  useEffect(() => {
    onSnapshot(jbrowse, async snapshot => {
      if (adminKey) {
        const config = JSON.parse(JSON.stringify(snapshot))
        deleteBaseUris(snapshot)
        const payload = { adminKey, config }

        const response = await fetch('/updateConfig', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const message = await response.text()
          session.notify(
            `Admin server error: ${response.status} (${response.statusText}) ${
              message || ''
            }`,
          )
        }
      }
    })
  }, [jbrowse, session, adminKey])

  if (error) {
    throw new Error(error)
  }

  const theme = getConf(rootModel.jbrowse, 'theme')
  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <CssBaseline />
      {/* {defaultScreen ? (
        <StartScreen
          root={rootModel}
          bypass={firstLoad}
          onFactoryReset={factoryReset}
        />
      ) : (
        <App
          session={session}
          HeaderButtons={<ShareButton session={session} />}
        />
      )} */}
      <App
        session={session}
        HeaderButtons={<ShareButton session={session} />}
      />
    </ThemeProvider>
  )
})

export default JBrowse
