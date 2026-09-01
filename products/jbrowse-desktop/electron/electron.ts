import { autoUpdater as nativeAutoUpdater, app, dialog } from 'electron'
import debug from 'electron-debug'
import pkg from 'electron-updater'

import { setupAutoUpdater } from './autoUpdater.ts'
import { createCloseGuard, subscribeQuitSignals } from './closeGuard.ts'
import { registerContextMenu } from './contextMenu.ts'
import { registerDownloadHandler } from './downloads.ts'
import { initializeFileSystem } from './fileSystemInit.ts'
import { registerAuthHandlers } from './ipc/authHandlers.ts'
import { registerBlatHandlers } from './ipc/blatHandlers.ts'
import { ipcSend } from './ipc/channels.ts'
import { registerFileHandlers } from './ipc/fileHandlers.ts'
import { registerGlobalPluginHandlers } from './ipc/globalPluginHandlers.ts'
import { registerPluginHandlers } from './ipc/pluginHandlers.ts'
import { registerQuickstartHandlers } from './ipc/quickstartHandlers.ts'
import { registerSessionHandlers } from './ipc/sessionHandlers.ts'
import { resolveLaunchMode } from './launchMode.ts'
import {
  JBROWSE_PROTOCOL,
  findLaunchTarget,
  parseProtocolUrl,
} from './launchTarget.ts'
import { describeLaunchLink } from './linkPrompt.ts'
import { startMcpBridge } from './mcp/bridge.ts'
import { defaultSocketPath } from './mcp/socketPath.ts'
import { runMcpStdioServer } from './mcp/stdioServer.ts'
import { initializePaths } from './paths.ts'
import { logError } from './util.ts'
import { buildAppUrl, createMainWindow } from './window.ts'

import type { CloseGuard } from './closeGuard.ts'
import type { LaunchTarget } from './launchTarget.ts'
import type { BrowserWindow } from 'electron'

const { autoUpdater } = pkg

// A rejection nobody handled left no trace at all: the main process has no
// terminal in a packaged app, so a menu item whose click handler rejected
// simply did nothing. Logging it is what makes the next one findable.
process.on('unhandledRejection', logError)

registerContextMenu()
debug({ showDevTools: false, isEnabled: true })

const DEV_SERVER_URL = process.env.DEV_SERVER_URL

// Accepts either --renderer=webgl or --renderer webgl. The value is forwarded
// to the renderer as a ?renderer= query param and consumed by setGpuOverride.
function findRendererArg(argv: readonly string[]) {
  const args = argv.slice(1)
  const inline = args.find(a => a.startsWith('--renderer='))
  const flagIndex = args.indexOf('--renderer')
  return inline
    ? inline.slice('--renderer='.length)
    : flagIndex === -1
      ? undefined
      : args[flagIndex + 1]
}

// Parsed once at launch; forwarded to every window/session load so a session
// reopened via second-instance keeps the same backend override.
const RENDERER_OVERRIDE = findRendererArg(process.argv)

function showFatalError(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const detail = error instanceof Error ? error.stack : undefined
  console.error(`${title}:`, error)
  dialog.showErrorBox(title, detail ? `${message}\n\n${detail}` : message)
  app.quit()
}

// Resolves to what should drive the first window: an argv argument (a file, or
// a jbrowse:// link on Windows/Linux), or the first 'open-file'/'open-url'
// event that fires before 'ready' (macOS delivers both that way on a cold
// launch). Resolves exactly once, when 'ready' fires.
//
// `on`, not `once`: a jbrowse:// url that doesn't parse resolves nothing, and a
// `once` listener is removed whether or not it did. So one unusable link ate the
// only pre-'ready' listener, and a good link arriving behind it — a browser that
// fires the handler twice, a user who clicks again when nothing happens — landed
// in the window before the app-level handlers exist and was dropped with no
// diagnostic. Resolving is what has to happen once, and a promise already does
// that; the listener staying is free. It also keeps `preventDefault` on every
// delivery rather than only the first.
function getInitialTarget(): Promise<LaunchTarget | undefined> {
  return new Promise(resolve => {
    const onOpenFile = (event: Electron.Event, filePath: string) => {
      event.preventDefault()
      resolve({ type: 'file', path: filePath })
    }
    const onOpenUrl = (event: Electron.Event, url: string) => {
      event.preventDefault()
      const link = parseProtocolUrl(url)
      if (link) {
        resolve({ type: 'link', url: link })
      }
    }
    app.on('open-file', onOpenFile)
    app.on('open-url', onOpenUrl)
    void app.whenReady().then(() => {
      app.off('open-file', onOpenFile)
      app.off('open-url', onOpenUrl)
      resolve(findLaunchTarget(process.argv, process.cwd()))
    })
  })
}

// Navigate the window to a target. This is a page load: whatever the renderer
// had is gone, which is why ensureWindow only takes this route when there is
// nothing to lose.
function loadTarget(win: BrowserWindow, target: LaunchTarget) {
  win
    .loadURL(buildAppUrl(DEV_SERVER_URL, target, RENDERER_OVERRIDE).href)
    .catch(logError)
}

// A jbrowse:// link is handed to us by whatever web page wanted it opened, and
// acting on one replaces the open session with the one the link describes. So
// confirm the destination first, the way the paste-a-link dialog does in-app:
// this is the only consent point on the protocol route when the linked config
// declares no plugins (an untrusted plugin has its own prompt). A file argument
// is not gated — it only ever comes from the user's own machine (argv or an OS
// open-file).
//
// The origin leads, because it is the question: a link the user really did click
// on jbrowse.org is accepted on sight, and one that arrived from somewhere else
// is refused on the same glance. The link itself follows, shortened — see
// describeLaunchLink for why it cannot be shown whole.
async function confirmOpenLink(url: string, parent: BrowserWindow | null) {
  const { origin, displayUrl } = describeLaunchLink(url)
  const options = {
    type: 'question' as const,
    buttons: ['Open', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Open JBrowse Web link',
    message: origin
      ? `Open a new session from ${origin}?`
      : 'Open a new session from this link?',
    detail: `${displayUrl}\n\nThis replaces the session you have open.`,
  }
  const { response } = await (parent
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options))
  return response === 0
}

// Tracks the single main window. Concurrent ensureWindow calls during creation
// share the in-flight promise; the 'closed' handler nulls both bindings
// together so the next call rebuilds the window.
function createWindowManager(closeGuard: CloseGuard) {
  let mainWindow: BrowserWindow | null = null
  let creating: Promise<BrowserWindow> | null = null

  async function startCreate(target: LaunchTarget | undefined) {
    try {
      const win = await createMainWindow(
        autoUpdater,
        DEV_SERVER_URL,
        target,
        RENDERER_OVERRIDE,
      )
      mainWindow = win
      // before the 'closed' handler below, so a close still gets held for the
      // session flush rather than racing the bookkeeping here
      closeGuard.register(win)
      win.on('closed', () => {
        mainWindow = null
        creating = null
      })
      return win
    } catch (error) {
      // Clear the in-flight promise so a later ensureWindow can retry instead
      // of awaiting a permanently-rejected creating promise
      creating = null
      throw error
    }
  }

  // Hand a target to a window that already exists.
  //
  // Navigating is a page load, and a page load is not a session close, so
  // nothing flushes: the autosave runs on a 1s debounce, and the last second of
  // edits went with the old page. The in-app route for this exact operation
  // (File -> Session -> "Open JBrowse Web link...") has always flushed first,
  // so an OS-delivered link and a pasted one did the same thing with different
  // amounts of data loss.
  //
  // So when the renderer has a session, ask *it* to do the swap — it flushes,
  // then replaces the plugin manager in place, which is the same code the menu
  // item runs. Two things fall out of that beyond the flush: no full reload of
  // the plugin graph, and a link that fails to load now leaves the session it
  // failed to replace still open, instead of having already navigated away from
  // it.
  //
  // With no session there is nothing to flush and no manager to swap, so the
  // navigating path stays — it is also the only one that works before the
  // renderer can answer at all, which is exactly when sessionOpen is false.
  function sendTarget(win: BrowserWindow, target: LaunchTarget) {
    if (closeGuard.sessionOpen) {
      ipcSend(win.webContents, 'openLaunchTarget', target)
    } else {
      loadTarget(win, target)
    }
  }

  async function ensureWindow(target?: LaunchTarget): Promise<BrowserWindow> {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      if (target) {
        sendTarget(mainWindow, target)
      }
      return mainWindow
    }
    if (creating) {
      const win = await creating
      if (target) {
        sendTarget(win, target)
      }
      return win
    }
    creating = startCreate(target)
    return creating
  }

  return {
    ensureWindow,
    get current() {
      return mainWindow
    },
  }
}

function runApp() {
  const initialTarget = getInitialTarget()
  // registers its ipc handlers here, before 'ready', for the same reason the
  // app-level listeners below are registered before any await
  const closeGuard = createCloseGuard({
    onQuitting: subscribeQuitSignals(app, nativeAutoUpdater),
    quitApp: () => {
      app.quit()
    },
  })
  const wm = createWindowManager(closeGuard)

  // Every route that can carry a launch target funnels through here so a link
  // is confirmed exactly once, wherever it arrived from (cold launch, macOS
  // open-url, Windows/Linux second-instance). A declined link still yields a
  // window — the start screen if none exists yet — rather than opening the
  // linked session.
  async function openTarget(target: LaunchTarget | undefined) {
    if (
      target?.type === 'link' &&
      !(await confirmOpenLink(target.url, wm.current))
    ) {
      await wm.ensureWindow()
    } else {
      await wm.ensureWindow(target)
    }
  }

  // Claims the jbrowse:// scheme so an "open in Desktop" link resolves here.
  // An installed app is already registered by its packaging — Info.plist on
  // macOS (scripts/packaging/packager.ts), the NSIS installer on Windows, the
  // .desktop file on Linux — so this mainly covers a dev run, and re-asserts
  // the claim if another install took the scheme over.
  app.setAsDefaultProtocolClient(JBROWSE_PROTOCOL)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  void app.whenReady().then(async () => {
    try {
      // app.getPath() is only reliable after 'ready'
      const paths = initializePaths()
      registerSessionHandlers(paths, () => wm.current)
      registerQuickstartHandlers(paths)
      registerFileHandlers(paths)
      registerGlobalPluginHandlers(paths)
      registerAuthHandlers()
      registerBlatHandlers()
      registerPluginHandlers()
      registerDownloadHandler()
      setupAutoUpdater(autoUpdater)
      // JBROWSE_DISABLE_MCP for deployments that don't want a code-executing
      // control socket at all (shared workstations, kiosk installs); see
      // electron/mcp/README.md for the threat model the default accepts
      if (!process.env.JBROWSE_DISABLE_MCP) {
        const stopMcpBridge = startMcpBridge({
          paths,
          getWindow: () => wm.current,
          openTarget: target => wm.ensureWindow(target),
        })
        app.on('will-quit', stopMcpBridge)
      }

      // Register app-level event handlers before any await so a second-instance
      // launch or macOS open-file/open-url that fires during filesystem init is
      // not dropped for lack of a listener
      app.on('second-instance', (_event, argv, workingDirectory) => {
        // Windows/Linux hand a jbrowse:// link to the running instance here, as
        // an argv entry — the same path a file argument takes
        openTarget(findLaunchTarget(argv, workingDirectory)).catch(logError)
      })
      app.on('open-file', (event, filePath) => {
        event.preventDefault()
        openTarget({ type: 'file', path: filePath }).catch(logError)
      })
      // macOS delivers a jbrowse:// link this way, whether or not the app is
      // already running
      app.on('open-url', (event, url) => {
        event.preventDefault()
        const link = parseProtocolUrl(url)
        if (link) {
          openTarget({ type: 'link', url: link }).catch(logError)
        }
      })
      app.on('activate', () => {
        wm.ensureWindow().catch(logError)
      })

      await initializeFileSystem(paths)
      await openTarget(await initialTarget)
    } catch (error) {
      showFatalError('Failed to initialize application', error)
    }
  })
}

const launchMode = resolveLaunchMode(process.argv, app.getVersion(), () =>
  app.requestSingleInstanceLock(),
)
if (launchMode.type === 'info') {
  console.log(launchMode.output)
  app.exit(0)
} else if (launchMode.type === 'mcp') {
  app.dock?.hide()
  runMcpStdioServer({
    socketPath: defaultSocketPath(),
    version: app.getVersion(),
    onExit: () => {
      app.exit(0)
    },
  })
} else if (launchMode.type === 'run') {
  runApp()
} else {
  app.quit()
}
