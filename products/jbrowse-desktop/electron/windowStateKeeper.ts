import fs from 'node:fs'
import path from 'node:path'

import { app, screen } from 'electron'

import type { BrowserWindow } from 'electron'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
  isFullScreen?: boolean
}

interface Options {
  defaultWidth: number
  defaultHeight: number
}

// enough of the window must land on some display to grab and drag it back
const MIN_VISIBLE_PX = 48

export default function windowStateKeeper(options: Options) {
  const { defaultWidth, defaultHeight } = options
  const stateFile = path.join(app.getPath('userData'), 'window-state.json')
  const state = loadState()
  let winRef: BrowserWindow | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function loadState(): WindowState {
    try {
      const saved = JSON.parse(
        fs.readFileSync(stateFile, 'utf8'),
      ) as WindowState
      if (isValidState(saved)) {
        return saved
      }
    } catch {
      // No saved state or invalid JSON
    }
    return { width: defaultWidth, height: defaultHeight }
  }

  function isValidState(s: WindowState) {
    const { x, y, width, height } = s
    const hasBounds =
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isInteger(width) &&
      width > 0 &&
      Number.isInteger(height) &&
      height > 0

    if (!hasBounds && !s.isMaximized && !s.isFullScreen) {
      return false
    }

    if (hasBounds && x !== undefined && y !== undefined) {
      // Overlap, not containment: a window straddling two monitors (or hanging
      // slightly off one edge) is still reachable, and demanding it fit wholly
      // inside a single display would reset it to default size on every restart.
      // Require a title-bar-sized sliver so a window on a now-disconnected
      // monitor still falls back to the default position.
      const visible = screen.getAllDisplays().some(display => {
        const b = display.bounds
        const overlapX = Math.min(x + width, b.x + b.width) - Math.max(x, b.x)
        const overlapY = Math.min(y + height, b.y + b.height) - Math.max(y, b.y)
        return overlapX >= MIN_VISIBLE_PX && overlapY >= MIN_VISIBLE_PX
      })
      if (!visible) {
        return false
      }
    }

    return true
  }

  function saveState() {
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true })
      fs.writeFileSync(stateFile, JSON.stringify(state))
    } catch {
      // Ignore write errors
    }
  }

  function updateState() {
    if (winRef) {
      try {
        const isNormal =
          !winRef.isMaximized() &&
          !winRef.isMinimized() &&
          !winRef.isFullScreen()
        if (isNormal) {
          const bounds = winRef.getBounds()
          state.x = bounds.x
          state.y = bounds.y
          state.width = bounds.width
          state.height = bounds.height
        }
        state.isMaximized = winRef.isMaximized()
        state.isFullScreen = winRef.isFullScreen()
      } catch {
        // Window might be destroyed before state is read
      }
    }
  }

  function onStateChange() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(updateState, 100)
  }

  function onClosed() {
    if (winRef) {
      winRef.off('resize', onStateChange)
      winRef.off('move', onStateChange)
      winRef.off('close', updateState)
      winRef.off('closed', onClosed)
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      winRef = null
    }
    saveState()
  }

  function manage(win: BrowserWindow) {
    if (state.isMaximized) {
      win.maximize()
    }
    if (state.isFullScreen) {
      win.setFullScreen(true)
    }
    win.on('resize', onStateChange)
    win.on('move', onStateChange)
    win.on('close', updateState)
    win.on('closed', onClosed)
    winRef = win
  }

  return {
    get x() {
      return state.x
    },
    get y() {
      return state.y
    },
    get width() {
      return state.width
    },
    get height() {
      return state.height
    },
    manage,
  }
}
