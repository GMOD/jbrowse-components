import { createAuthWindow } from '../window.ts'
import { ipcHandle } from './channels.ts'

export function registerAuthHandlers() {
  ipcHandle('openAuthWindow', (_, params) => {
    return createAuthWindow(params)
  })
}
