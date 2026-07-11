import { ipcMain } from 'electron'

import type { AuthWindowParams } from '../window.ts'
import type { IpcMainInvokeEvent } from 'electron'

export interface RecentSession {
  path: string
  updated: number
  name?: string
}

export interface RecentSessionInfo extends RecentSession {
  isAutosave: boolean
}

export interface SessionSnap {
  defaultSession?: { name?: string }
  assemblies?: unknown[]
  [key: string]: unknown
}

export interface IpcChannels {
  quit: { args: []; return: void }
  userData: { args: []; return: string }
  indexFasta: {
    args: [location: { uri: string } | { localPath: string }]
    return: string
  }
  promptOpenFile: { args: []; return: string | undefined }
  promptOpenLocalFile: {
    args: [defaultDir?: string]
    return: string | undefined
  }
  promptSessionSaveAs: { args: []; return: string | undefined }
  listSessions: { args: []; return: RecentSessionInfo[] }
  loadSession: { args: [sessionPath: string]; return: SessionSnap }
  createInitialAutosaveFile: { args: [snap: SessionSnap]; return: string }
  saveSession: { args: [sessionPath: string, snap: SessionSnap]; return: void }
  deleteSessions: { args: [sessionPaths: string[]]; return: void }
  renameSession: { args: [sessionPath: string, newName: string]; return: void }
  showItemInFolder: { args: [sessionPath: string]; return: void }
  loadThumbnail: { args: [name: string]; return: string | undefined }
  reset: { args: []; return: void }
  listQuickstarts: { args: []; return: string[] }
  addToQuickstartList: {
    args: [sessionPath: string, sessionName: string]
    return: void
  }
  getQuickstart: { args: [name: string]; return: unknown }
  deleteQuickstart: { args: [name: string]; return: void }
  renameQuickstart: { args: [oldName: string, newName: string]; return: void }
  openAuthWindow: {
    args: [params: AuthWindowParams]
    return: string | undefined
  }
  // opens the BLAT server in a window so the user can solve its CAPTCHA
  openBlatChallenge: { args: [url: string]; return: boolean }
  // POSTs a BLAT query from the main process so the solved-challenge cookie
  // (held in the default session) attaches first-party; returns the raw body
  blatFetch: {
    args: [url: string, body: string]
    return: { ok: boolean; status: number; text: string }
  }
}

type IpcHandler<K extends keyof IpcChannels> = (
  event: IpcMainInvokeEvent,
  ...args: IpcChannels[K]['args']
) => Promise<IpcChannels[K]['return']> | IpcChannels[K]['return']

export function ipcHandle<K extends keyof IpcChannels>(
  channel: K,
  handler: IpcHandler<K>,
) {
  ipcMain.handle(
    channel,
    handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  )
}
