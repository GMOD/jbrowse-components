import { ipcMain } from 'electron'

import { createAuthWindow } from '../window.ts'

import type { AuthWindowParams } from '../window.ts'

export function registerAuthHandlers() {
  ipcMain.handle('openAuthWindow', (_, params: AuthWindowParams) => {
    return createAuthWindow(params)
  })
}
