import { app } from 'electron'

import type { Input } from 'electron'

const isMac = process.platform === 'darwin'

export function shortcutFor(input: Input, isPackaged: boolean) {
  if (input.type !== 'keyDown') {
    return undefined
  }
  const command = isMac ? input.meta : input.control
  if (
    input.key === 'F12' ||
    (input.code === 'KeyI' && command && (isMac ? input.alt : input.shift))
  ) {
    return 'toggleDevTools' as const
  }
  // A reload drops the open session back to the start screen, so only a
  // development build answers to the browser's reload keys
  if (
    !isPackaged &&
    (input.key === 'F5' || (input.code === 'KeyR' && command))
  ) {
    return 'reload' as const
  }
  return undefined
}

export function registerDevToolsShortcuts() {
  app.on('browser-window-created', (_event, window) => {
    const { webContents } = window
    webContents.on('before-input-event', (event, input) => {
      const shortcut = shortcutFor(input, app.isPackaged)
      if (shortcut) {
        event.preventDefault()
        if (shortcut === 'toggleDevTools') {
          webContents.toggleDevTools()
        } else {
          webContents.reloadIgnoringCache()
        }
      }
    })
  })
}
