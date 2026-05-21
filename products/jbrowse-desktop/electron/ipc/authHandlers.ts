import { ipcMain } from 'electron'

import { createAuthWindow } from '../window.ts'

export function registerAuthHandlers() {
  ipcMain.handle(
    'openAuthWindow',
    (
      _,
      params: {
        internetAccountId: string
        data: { redirect_uri: string }
        url: string
      },
    ) => {
      return createAuthWindow(params)
    },
  )
}
