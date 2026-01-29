import fs from 'fs'
import path from 'path'

import { app, screen } from 'electron'

import type { BrowserWindow, Rectangle } from 'electron'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
  isFullScreen?: boolean
  displayBounds?: Rectangle
}

interface WindowStateKeeperOptions {
  defaultWidth?: number
  defaultHeight?: number
  file?: string
  path?: string
  maximize?: boolean
  fullScreen?: boolean
}

export default function windowStateKeeper(options: WindowStateKeeperOptions = {}) {
  const config = {
    file: 'window-state.json',
    path: app.getPath('userData'),
    maximize: true,
    fullScreen: true,
    ...options,
  }

  const fullStoreFileName = path.join(config.path, config.file)
  let state: WindowState
  let winRef: BrowserWindow | null = null
  let stateChangeTimer: ReturnType<typeof setTimeout> | null = null
  const eventHandlingDelay = 100

  function isNormal(win: BrowserWindow) {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen()
  }

  function hasBounds() {
    return (
      state &&
      Number.isInteger(state.x) &&
      Number.isInteger(state.y) &&
      Number.isInteger(state.width) &&
      state.width > 0 &&
      Number.isInteger(state.height) &&
      state.height > 0
    )
  }

  function resetStateToDefault() {
    const displayBounds = screen.getPrimaryDisplay().bounds
    state = {
      width: config.defaultWidth || 800,
      height: config.defaultHeight || 600,
      x: 0,
      y: 0,
      displayBounds,
    }
  }

  function windowWithinBounds(bounds: Rectangle) {
    return (
      state.x! >= bounds.x &&
      state.y! >= bounds.y &&
      state.x! + state.width <= bounds.x + bounds.width &&
      state.y! + state.height <= bounds.y + bounds.height
    )
  }

  function ensureWindowVisibleOnSomeDisplay() {
    const visible = screen.getAllDisplays().some(display => windowWithinBounds(display.bounds))
    if (!visible) {
      resetStateToDefault()
    }
  }

  function validateState() {
    const isValid = state && (hasBounds() || state.isMaximized || state.isFullScreen)
    if (!isValid) {
      state = { width: config.defaultWidth || 800, height: config.defaultHeight || 600 }
      return
    }
    if (hasBounds() && state.displayBounds) {
      ensureWindowVisibleOnSomeDisplay()
    }
  }

  function updateState(win?: BrowserWindow | null) {
    win = win || winRef
    if (!win) {
      return
    }
    try {
      const winBounds = win.getBounds()
      if (isNormal(win)) {
        state.x = winBounds.x
        state.y = winBounds.y
        state.width = winBounds.width
        state.height = winBounds.height
      }
      state.isMaximized = win.isMaximized()
      state.isFullScreen = win.isFullScreen()
      state.displayBounds = screen.getDisplayMatching(winBounds).bounds
    } catch {
      // Window might be closed
    }
  }

  function saveState(win?: BrowserWindow) {
    if (win) {
      updateState(win)
    }
    try {
      fs.mkdirSync(path.dirname(fullStoreFileName), { recursive: true })
      fs.writeFileSync(fullStoreFileName, JSON.stringify(state))
    } catch {
      // Ignore write errors
    }
  }

  function stateChangeHandler() {
    if (stateChangeTimer) {
      clearTimeout(stateChangeTimer)
    }
    stateChangeTimer = setTimeout(updateState, eventHandlingDelay)
  }

  function closeHandler() {
    updateState()
  }

  function closedHandler() {
    unmanage()
    saveState()
  }

  function manage(win: BrowserWindow) {
    if (config.maximize && state.isMaximized) {
      win.maximize()
    }
    if (config.fullScreen && state.isFullScreen) {
      win.setFullScreen(true)
    }
    win.on('resize', stateChangeHandler)
    win.on('move', stateChangeHandler)
    win.on('close', closeHandler)
    win.on('closed', closedHandler)
    winRef = win
  }

  function unmanage() {
    if (winRef) {
      winRef.removeListener('resize', stateChangeHandler)
      winRef.removeListener('move', stateChangeHandler)
      if (stateChangeTimer) {
        clearTimeout(stateChangeTimer)
      }
      winRef.removeListener('close', closeHandler)
      winRef.removeListener('closed', closedHandler)
      winRef = null
    }
  }

  // Load previous state
  try {
    state = JSON.parse(fs.readFileSync(fullStoreFileName, 'utf8'))
  } catch {
    state = { width: config.defaultWidth || 800, height: config.defaultHeight || 600 }
  }

  validateState()

  state = {
    width: config.defaultWidth || 800,
    height: config.defaultHeight || 600,
    ...state,
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
    get displayBounds() {
      return state.displayBounds
    },
    get isMaximized() {
      return state.isMaximized
    },
    get isFullScreen() {
      return state.isFullScreen
    },
    saveState,
    unmanage,
    manage,
    resetStateToDefault,
  }
}
