import fs from 'fs'
import path from 'path'

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
    const hasBounds =
      Number.isInteger(s.x) &&
      Number.isInteger(s.y) &&
      Number.isInteger(s.width) &&
      s.width > 0 &&
      Number.isInteger(s.height) &&
      s.height > 0

    if (!hasBounds && !s.isMaximized && !s.isFullScreen) {
      return false
    }

    // Ensure window is visible on some display
    if (hasBounds) {
      const visible = screen.getAllDisplays().some(display => {
        const b = display.bounds
        return (
          s.x! >= b.x &&
          s.y! >= b.y &&
          s.x! + s.width <= b.x + b.width &&
          s.y! + s.height <= b.y + b.height
        )
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
    if (!winRef) {
      return
    }
    try {
      const isNormal =
        !winRef.isMaximized() && !winRef.isMinimized() && !winRef.isFullScreen()
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
      // Window might be closed
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
