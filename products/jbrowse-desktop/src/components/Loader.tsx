import { useEffect, useState, useSyncExternalStore } from 'react'

import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { localStorageGetItem } from '@jbrowse/core/util'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowse from './JBrowse.tsx'
import StartScreen from './StartScreen/StartScreen.tsx'
import {
  createStartScreenPluginManager,
  loadPluginManager,
} from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

function getHash() {
  return window.location.hash
}

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => {
    window.removeEventListener('hashchange', callback)
  }
}

function parseHash(hash: string) {
  if (hash.startsWith('#/session?')) {
    const params = new URLSearchParams(hash.slice('#/session?'.length))
    return { page: 'session' as const, config: params.get('config') ?? '' }
  }
  return { page: 'start' as const, config: '' }
}

const SessionPage = observer(function SessionPage({
  configPath,
}: {
  configPath: string
}) {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setPluginManager(await loadPluginManager(configPath))
      } catch (e: unknown) {
        console.error(e)
        setError(e)
      }
    })()
  }, [configPath])

  if (error) {
    return <ErrorMessage error={error} />
  }
  if (pluginManager?.rootModel?.session) {
    return <JBrowse pluginManager={pluginManager} />
  }
  return <LoadingEllipses />
})

const StartPage = observer(function StartPage() {
  const [startScreenPluginManager, setStartScreenPluginManager] =
    useState<PluginManager>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    createStartScreenPluginManager()
      .then(pm => {
        setStartScreenPluginManager(pm)
      })
      .catch((e: unknown) => {
        console.error('Failed to create start screen plugin manager', e)
      })
  }, [])

  return (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <StartScreen
        setError={setError}
        startScreenPluginManager={startScreenPluginManager}
      />
    </>
  )
})

const Loader = observer(function Loader() {
  const hash = useSyncExternalStore(subscribeHash, getHash, () => '')
  const { page, config } = parseHash(hash)

  return (
    <ThemeProvider
      theme={createJBrowseTheme(
        undefined,
        undefined,
        localStorageGetItem('themeName') || 'default',
      )}
    >
      <CssBaseline />
      {page === 'session' && config ? (
        <SessionPage key={config} configPath={config} />
      ) : (
        <StartPage />
      )}
    </ThemeProvider>
  )
})

export default Loader
