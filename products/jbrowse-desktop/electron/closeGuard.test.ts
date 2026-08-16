/**
 * @jest-environment node
 *
 * The close guard holds the window open for exactly one session flush. Every
 * test here is a way that could go wrong instead: a window that will not close,
 * a macOS Quit that only closes the window and leaves the app running, or a
 * close waiting on a renderer that can no longer answer.
 */
import { createCloseGuard, subscribeQuitSignals } from './closeGuard.ts'
import { captureHandlers } from './ipc/testUtil.ts'

import type { CloseGuard } from './closeGuard.ts'

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }))

type Listener = (...args: unknown[]) => void

// Enough of a BrowserWindow to drive close/destroy and see what was pushed.
function makeWindow() {
  const listeners = new Map<string, Listener[]>()
  const on = (event: string, fn: Listener) => {
    listeners.set(event, [...(listeners.get(event) ?? []), fn])
  }
  const emit = (event: string, ...args: unknown[]) => {
    for (const fn of listeners.get(event) ?? []) {
      fn(...args)
    }
  }
  const sent: string[] = []
  let destroyed = false

  const window = {
    on,
    isDestroyed: () => destroyed,
    destroy: () => {
      destroyed = true
    },
    // one listener map for both, since the event names don't collide
    webContents: {
      on,
      send: (channel: string) => {
        sent.push(channel)
      },
    },
  } as unknown as Electron.BrowserWindow

  return {
    window,
    sent,
    isDestroyed: () => destroyed,
    /**
     * emit 'close'; returns whether the guard prevented it
     */
    close: () => {
      let prevented = false
      emit('close', {
        preventDefault: () => {
          prevented = true
        },
      })
      return prevented
    },
    emit,
  }
}

// Stands in for app / Electron's autoUpdater, wired through the real
// subscribeQuitSignals so the tests below fire the events those two emit rather
// than a listener the setup invented.
function makeQuitSource<E extends string>() {
  const listeners: (() => void)[] = []
  return {
    source: {
      on: (_event: E, listener: () => void) => {
        listeners.push(listener)
      },
    },
    emit: () => {
      for (const fn of listeners) {
        fn()
      }
    },
  }
}

function setup() {
  const quitApp = jest.fn()
  const app = makeQuitSource<'before-quit'>()
  const updater = makeQuitSource<'before-quit-for-update'>()
  let guard!: CloseGuard
  const invoke = captureHandlers(() => {
    guard = createCloseGuard({
      onQuitting: subscribeQuitSignals(app.source, updater.source),
      quitApp,
    })
  })
  const win = makeWindow()
  guard.register(win.window)
  return {
    invoke,
    quitApp,
    win,
    guard,
    beforeQuit: app.emit,
    beforeQuitForUpdate: updater.emit,
  }
}

test('closes at once when no session is open', async () => {
  const { win } = setup()

  // the start screen, or an app still loading — nothing to flush, and holding
  // here is what would make a half-started app unquittable
  expect(win.close()).toBe(false)
  expect(win.sent).toEqual([])
  await Promise.resolve()
})

test('holds the close and asks the renderer to flush when a session is open', async () => {
  const { invoke, win } = setup()
  await invoke('setSessionOpen', true)

  expect(win.close()).toBe(true)
  expect(win.sent).toEqual(['flushSessionForClose'])
  expect(win.isDestroyed()).toBe(false)
})

test('the flush reply closes the window', async () => {
  const { invoke, win, quitApp } = setup()
  await invoke('setSessionOpen', true)
  win.close()

  await invoke('sessionFlushed')

  expect(win.isDestroyed()).toBe(true)
  // this close was not part of a quit, so nothing should re-issue one
  expect(quitApp).not.toHaveBeenCalled()
})

test('a quit that was held is re-issued once the flush lands', async () => {
  const { invoke, win, quitApp, beforeQuit } = setup()
  await invoke('setSessionOpen', true)
  // app.quit() fires before-quit, then closes the window; holding that close
  // cancels the quit, so without re-issuing it macOS would be left running with
  // no window
  beforeQuit()
  win.close()

  await invoke('sessionFlushed')

  expect(win.isDestroyed()).toBe(true)
  expect(quitApp).toHaveBeenCalledTimes(1)
})

// quitAndInstall closes the windows and only then quits, and Electron documents
// that it does NOT emit before-quit on the way. So the guard has to learn about
// the quit from the updater's own event; without it the hold cancels the quit,
// the window goes away, the app stays up, and the update never installs — with
// nothing on screen to say so.
test('an update install that was held is re-issued once the flush lands', async () => {
  const { invoke, win, quitApp, beforeQuitForUpdate } = setup()
  await invoke('setSessionOpen', true)

  beforeQuitForUpdate()
  expect(win.close()).toBe(true)

  await invoke('sessionFlushed')

  expect(win.isDestroyed()).toBe(true)
  expect(quitApp).toHaveBeenCalledTimes(1)
})

test('a second close gets out even if the renderer never answers', async () => {
  const { invoke, win } = setup()
  await invoke('setSessionOpen', true)

  expect(win.close()).toBe(true)
  // no sessionFlushed ever arrives — clicking the X again must not be held too,
  // which is the escape hatch that replaces a timeout
  expect(win.close()).toBe(false)
})

test('a dead renderer un-gates the close', async () => {
  const { invoke, win } = setup()
  await invoke('setSessionOpen', true)

  win.emit('render-process-gone')

  // it cannot flush, so waiting on it would hang; the worst case is the
  // behavior from before the guard existed
  expect(win.close()).toBe(false)
  expect(win.sent).toEqual([])
})

test('an unresponsive renderer un-gates the close', async () => {
  const { invoke, win } = setup()
  await invoke('setSessionOpen', true)

  win.emit('unresponsive')

  expect(win.close()).toBe(false)
})

test('returning to the start screen un-gates the close', async () => {
  const { invoke, win } = setup()
  await invoke('setSessionOpen', true)
  await invoke('setSessionOpen', false)

  expect(win.close()).toBe(false)
  expect(win.sent).toEqual([])
})

// `sessionOpen` is also what ensureWindow reads to decide whether an incoming
// launch target can be handed to the live renderer (which flushes and swaps in
// place) or has to navigate the window. It is the same value the hold above
// uses, so these cover the routing decision rather than restating the hold.
describe('sessionOpen, as ensureWindow reads it', () => {
  test('is false before the renderer reports a session', () => {
    // the window exists but the renderer is still booting: there is nobody to
    // hand a target to yet, so a launch has to navigate
    expect(setup().guard.sessionOpen).toBe(false)
  })

  test('follows the renderer both ways', async () => {
    const { invoke, guard } = setup()

    await invoke('setSessionOpen', true)
    expect(guard.sessionOpen).toBe(true)

    // back on the start screen there is nothing to flush and no manager to
    // swap, so a launch navigates again
    await invoke('setSessionOpen', false)
    expect(guard.sessionOpen).toBe(false)
  })

  test('a dead renderer reads as no session', async () => {
    const { invoke, guard, win } = setup()
    await invoke('setSessionOpen', true)

    win.emit('render-process-gone')

    // pushing a target at a renderer that cannot answer would drop it with no
    // diagnostic; reading false is what sends it back down the navigating path
    expect(guard.sessionOpen).toBe(false)
  })

  test('an unresponsive renderer reads as no session', async () => {
    const { invoke, guard, win } = setup()
    await invoke('setSessionOpen', true)

    win.emit('unresponsive')

    expect(guard.sessionOpen).toBe(false)
  })
})
