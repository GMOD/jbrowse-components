import React, { useEffect } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import ShareButton from './ShareButton'

// adapted from https://github.com/jashkenas/underscore/blob/5d8ab5e37c9724f6f1181c5f95d0020815e4cb77/underscore.js#L894-L925
function debounce(func, wait) {
  let timeout
  let result
  const later = (...args) => {
    timeout = null
    result = func(...args)
  }
  const debounced = (...args) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      return later(...args)
    }, wait)
    return result
  }
  debounced.cancel = () => {
    clearTimeout(timeout)
    timeout = null
  }
  return debounced
}

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
  const queryParams = new URLSearchParams(window.location.search)
  const sessionId = queryParams.get('session')
  const [adminKey] = useQueryParam('adminKey', StringParam)
  const [sessionId, setSessionId] = useQueryParam('session', StringParam)

  const { rootModel } = pluginManager
  const { error, jbrowse } = rootModel || {}

  // updates the session or local storage sessions + autosave
  useEffect(() => {
    function updateLocalSession(snapshot) {
      const toStore = JSON.stringify({ session: snapshot })
      const autosaveStore = JSON.stringify({
        session: {
          ...snapshot,
          name: `${snapshot.name}-autosaved`,
        },
      })
      if (
        sessionId?.startsWith('local-') &&
        sessionStorage.getItem('current')
      ) {
        sessionStorage.setItem('current', toStore)
      } else if (sessionId?.startsWith('localSaved-')) {
        localStorage.setItem(sessionId, toStore)
        if (localStorage.getItem('autosave')) {
          localStorage.removeItem('autosave')
        }
      }

      localStorage.setItem('autosave', autosaveStore)
    }

    let disposer = () => {}
    if (rootModel) {
      const updater = debounce(updateLocalSession, 400)
      const snapshotDisposer = onSnapshot(rootModel, snap => {
        updater(snap.session)
        setSessionId(snap.session.id)
        sessionStorage.setItem('current', JSON.stringify(snap.session))
      })
      disposer = () => {
        snapshotDisposer()
        updater.cancel()
      }
    }
    return disposer
  }, [rootModel, sessionId])

  useEffect(() => {
    onSnapshot(jbrowse, async snapshot => {
      if (adminKey) {
        const config = JSON.parse(JSON.stringify(snapshot))
        deleteBaseUris(snapshot)
        const payload = { adminKey: adminKeyParam, config }

        const response = await fetch('/updateConfig', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const message = await response.text()
          rootModel.session.notify(
            `Admin server error: ${response.status} (${response.statusText}) ${
              message || ''
            }`,
          )
        }
      }
    })
  }, [jbrowse, rootModel.session, adminKey, adminKeyParam])

  if (error) {
    throw new Error(error)
  }

  const theme = getConf(rootModel.jbrowse, 'theme')
  const { session } = rootModel
  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <CssBaseline />
      <App
        session={session}
        HeaderButtons={<ShareButton session={session} />}
      />
    </ThemeProvider>
  )
})

export default JBrowse
