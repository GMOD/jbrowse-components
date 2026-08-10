import { Suspense, lazy, useMemo, useRef, useState } from 'react'

import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { localStorageGetItem } from '@jbrowse/core/util'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import { setGpuOverride } from '@jbrowse/render-core/gpuDevice'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import { invokeIpc } from '../ipc.ts'
import { useIpc } from '../useIpc.ts'
import { deleteQueryParams, useQueryParam } from '../useQueryParam.ts'
import { NotificationProvider } from './Notifications.tsx'
import { useNotifyError } from './NotifyContext.ts'
import StartScreen from './StartScreen/StartScreen.tsx'
import {
  destroyPluginManager,
  loadPluginManager,
  openSpecLink,
} from './StartScreen/util.tsx'
import { usePluginManagerLoad } from './usePluginManagerLoad.ts'

import type { DesktopRootModel } from '../rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

setGpuOverride(new URLSearchParams(window.location.search).get('renderer'))

// The session UI — @jbrowse/app-core's App, and with it dockview, the drawer
// widgets and their Material chrome — is what the start screen exists to get you
// to, not what it is made of. Lazy so launching to the start screen doesn't
// evaluate it first; by the time this resolves the session's plugin manager has
// already been built, which takes considerably longer.
const JBrowse = lazy(() => import('./JBrowse.tsx'))

// Both launch params are one-shot: once the session they name is built (or has
// failed to build) they have to leave the address bar, or the next read reopens
// it. Cleared together because at most one was ever set.
function clearTarget() {
  deleteQueryParams(['config', 'specLink'])
}

const LoaderContents = observer(function LoaderContents() {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config] = useQueryParam('config')
  // a jbrowse:// link the main process resolved to a JBrowse Web url
  const [specLink] = useQueryParam('specLink')
  const notifyError = useNotifyError()

  // The installed manager, readable synchronously. Replacing one is a side
  // effect — it terminates RPC worker threads and destroys an MST tree — and
  // React may call a state updater more than once, so that work must not live
  // inside one. A ref rather than the `pluginManager` state because two loads
  // can resolve before a re-render, and the second must still see what the
  // first installed.
  const installedRef = useRef<PluginManager | undefined>(undefined)

  // Install a manager, tearing down whatever it replaces so its worker pool and
  // autosave loop don't leak. undefined installs nothing, which is what
  // returning to the start screen wants.
  const replacePluginManager = useEventCallback((pm?: PluginManager) => {
    const previous = installedRef.current
    if (previous && previous !== pm) {
      destroyPluginManager(previous)
    }
    installedRef.current = pm
    setPluginManager(pm)
    // The main process holds the window's close only while there is a session
    // to flush, so this has to be told both ways round — including on the way
    // back to the start screen, or closing from there would wait for a flush
    // nothing is going to send.
    invokeIpc('setSessionOpen', Boolean(pm)).catch(console.error)
  })

  // Closing the window (title bar, Cmd+W, macOS Quit) never went through the
  // renderer, so the last second of edits died with it — the Exit menu item has
  // flushed for exactly this reason for a while. Main asks; this answers, and
  // must answer even when the flush fails, or the close it is holding never
  // completes.
  useIpc('flushSessionForClose', () => {
    const rootModel = installedRef.current?.rootModel as
      | DesktopRootModel
      | undefined
    Promise.resolve(rootModel?.flushSession())
      .catch(console.error)
      .finally(() => {
        invokeIpc('sessionFlushed').catch(console.error)
      })
  })

  const handleSetPluginManager = useEventCallback((pm: PluginManager) => {
    const rootModel = pm.rootModel as DesktopRootModel | undefined
    rootModel?.setOpenNewSessionCallback(async (path: string) => {
      handleSetPluginManager(await loadPluginManager(path))
    })
    rootModel?.setOpenLinkCallback(async (link: string) => {
      handleSetPluginManager(await openSpecLink(link))
    })
    rootModel?.setReturnToStartScreenCallback(() => {
      // "Return to start screen": tear down the manager and leave none, so its
      // RPC workers + autosave loop don't leak behind the start screen
      replacePluginManager(undefined)
    })

    replacePluginManager(pm)
    clearTarget()
  })

  // What the main process asked this window to open, if anything. buildAppUrl
  // writes one param or the other, never both, so one load covers both routes
  // and `config` decides which of the two it is.
  const target = config ?? specLink

  const loadTarget = useEventCallback((source: string) =>
    config ? loadPluginManager(source) : openSpecLink(source),
  )

  const handleTargetError = useEventCallback((e: unknown) => {
    // A failing config path is a recent-session entry we can prune, so offer it
    // as a toast action rather than leaving a dead row behind. A bad link is not
    // one, so it gets a plain error.
    notifyError(
      e,
      config
        ? {
            label: 'Remove from recent sessions',
            onClick: () => {
              invokeIpc('removeRecentSession', config).catch(console.error)
            },
          }
        : undefined,
    )
    // fall back to the start screen so the user can pick another session
    clearTarget()
  })

  usePluginManagerLoad(
    target,
    loadTarget,
    handleSetPluginManager,
    handleTargetError,
  )

  const loading = <LoadingEllipses variant="h6" message="Loading session" />

  return pluginManager?.rootModel?.session ? (
    <Suspense fallback={loading}>
      <JBrowse pluginManager={pluginManager} />
    </Suspense>
  ) : target ? (
    loading
  ) : (
    <StartScreen setPluginManager={handleSetPluginManager} />
  )
})

export default function Loader() {
  const theme = useMemo(
    () =>
      createJBrowseTheme(
        undefined,
        undefined,
        localStorageGetItem('themeName') || 'default',
      ),
    [],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <LoaderContents />
      </NotificationProvider>
    </ThemeProvider>
  )
}
