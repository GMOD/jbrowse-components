import { Suspense, lazy, useMemo, useRef, useState } from 'react'

import { deleteQueryParams, useQueryParam } from '@jbrowse/app-core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { localStorageGetItem } from '@jbrowse/core/util'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import { setGpuOverride } from '@jbrowse/render-core/gpuDevice'
import { CssBaseline, LinearProgress, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import { invokeIpc } from '../ipc.ts'
import { useIpc } from '../useIpc.ts'
import { NotificationProvider } from './Notifications.tsx'
import { useNotifyError } from './NotifyContext.ts'
import SessionLoadingScreen from './SessionLoadingScreen.tsx'
import StartScreen from './StartScreen/StartScreen.tsx'
import {
  destroyPluginManager,
  loadPluginManager,
  openSpecLink,
} from './StartScreen/util.tsx'
import { useLaunchTarget } from './useLaunchTarget.ts'
import { usePluginManagerLoad } from './usePluginManagerLoad.ts'
import { useSessionSwap } from './useSessionSwap.ts'

import type { LaunchTarget } from '../../electron/ipc/channelTypes.ts'
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

// PluginManager types `rootModel` as the generic state-tree node it is for every
// product; on desktop it is always this one, and this is the only place that
// narrowing is written down rather than restated at each of the reads below.
function desktopRootModel(pluginManager: PluginManager | undefined) {
  return pluginManager?.rootModel as DesktopRootModel | undefined
}

// A failing config path is a recent-session entry we can prune, so offer it as a
// toast action rather than leaving a dead row behind. A bad link is not one, so
// it gets a plain error.
function removeRecentAction(path: string) {
  return {
    label: 'Remove from recent sessions',
    onClick: () => {
      invokeIpc('removeRecentSession', path).catch(console.error)
    },
  }
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
    const rootModel = desktopRootModel(installedRef.current)
    Promise.resolve(rootModel?.flushSession())
      .catch(console.error)
      .finally(() => {
        invokeIpc('sessionFlushed').catch(console.error)
      })
  })

  const handleSetPluginManager = useEventCallback((pm: PluginManager) => {
    const rootModel = desktopRootModel(pm)
    // Both in-app routes to a session replacement go through the same swap the
    // pushed one does, so all three flush at the same moment — between the load
    // resolving and the install. Their menu items used to call flushSession
    // before invoking these, which left everything edited during the load unsaved
    // when replacePluginManager destroyed the old manager.
    //
    // Rejections are left to propagate: each caller has somewhere better to put
    // them than this does — the link dialog reports inline, and the file route's
    // menu item catches into the session's error reporter.
    rootModel?.setOpenNewSessionCallback(async (path: string) => {
      await swap(() => loadPluginManager(path))
    })
    rootModel?.setOpenLinkCallback(async (link: string) => {
      await swap(() => openSpecLink(link))
    })
    rootModel?.setReturnToStartScreenCallback(() => {
      // "Return to start screen": tear down the manager and leave none, so its
      // RPC workers + autosave loop don't leak behind the start screen
      replacePluginManager(undefined)
    })

    replacePluginManager(pm)
    clearTarget()
  })

  const { swap, swapping } = useSessionSwap({
    flush: useEventCallback(async () => {
      await desktopRootModel(installedRef.current)?.flushSession()
    }),
    onLoad: handleSetPluginManager,
  })

  // A launch that arrived while a session is already open (a jbrowse:// link, an
  // OS open-file, a second-instance argv). The only swap trigger with nowhere to
  // return a rejection to, so it reports its own.
  useLaunchTarget({
    swap,
    load: useEventCallback((target: LaunchTarget) =>
      target.type === 'file'
        ? loadPluginManager(target.path)
        : openSpecLink(target.url),
    ),
    onError: useEventCallback((e: unknown, target: LaunchTarget) => {
      // The session this failed to replace is still open and still on screen —
      // nothing was torn down — so this notifies rather than falling back to
      // the start screen the way the query-string route has to.
      notifyError(
        e,
        target.type === 'file' ? removeRecentAction(target.path) : undefined,
      )
    }),
  })

  // What the main process asked this window to open, if anything. buildAppUrl
  // writes one param or the other, never both, so one load covers both routes
  // and `config` decides which of the two it is.
  const target = config ?? specLink

  const loadTarget = useEventCallback((source: string) =>
    config ? loadPluginManager(source) : openSpecLink(source),
  )

  const handleTargetError = useEventCallback((e: unknown) => {
    notifyError(e, config ? removeRecentAction(config) : undefined)
    // fall back to the start screen so the user can pick another session
    clearTarget()
  })

  usePluginManagerLoad(
    target,
    loadTarget,
    handleSetPluginManager,
    handleTargetError,
  )

  const loading = <SessionLoadingScreen fullscreen />

  return (
    <>
      {/* A launch pushed from the main process keeps the open session up while
      it loads, so this bar is the only sign the click did anything. Not a
      blocking overlay: the load can be a config fetch over a slow link, and the
      session underneath is still perfectly usable — and still autosaving, with
      the flush that precedes the swap taking whatever is edited meanwhile. */}
      {swapping ? (
        <LinearProgress
          aria-label="Opening link"
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            // over the app chrome, which is what it is reporting on
            zIndex: theme => theme.zIndex.tooltip,
          }}
        />
      ) : null}
      {pluginManager?.rootModel?.session ? (
        <Suspense fallback={loading}>
          <JBrowse pluginManager={pluginManager} />
        </Suspense>
      ) : target ? (
        loading
      ) : (
        <StartScreen setPluginManager={handleSetPluginManager} />
      )}
    </>
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
