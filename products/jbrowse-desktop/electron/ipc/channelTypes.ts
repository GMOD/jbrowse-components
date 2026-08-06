// The contract between the two processes: every channel, its arguments, and
// what it resolves to. Both sides depend on this and neither owns it, so it is
// deliberately import-free — no `electron`, no `node:*`, nothing from
// @jbrowse/core. That is what lets the renderer (src/ipc.ts, compiled for the
// browser) and the main process (channels.ts, which needs ipcMain) share one
// definition instead of each restating it.
//
// Keep it that way: an import here would drag the main process's module graph
// into the web typecheck, or the DOM lib into the electron one.

export interface RecentSession {
  path: string
  updated: number
  name?: string
}

export interface RecentSessionInfo extends RecentSession {
  isAutosave: boolean
}

// A session/config file as it sits on disk. The main process only parses it and
// checks that `assemblies` is there — the field types below are the documented
// shape of the file, not something either side validates, which is why
// everything else stays `unknown`.
export interface SessionSnap {
  defaultSession?: { name?: string }
  assemblies?: { name: string }[]
  [key: string]: unknown
}

/**
 * Pushes from the main process to the renderer — the one direction the invoke
 * channels above cannot express, since only the renderer can invoke.
 *
 * Kept to the minimum: a push has no reply, so anything needing one costs a
 * channel in each direction (here, sessionFlushed) and a reason why the work
 * cannot simply be done when the renderer next asks for something.
 */
export interface IpcPushChannels {
  // Sent when the window is closing and a session is open. The renderer flushes
  // it and answers with sessionFlushed; until then the close is held.
  flushSessionForClose: { args: [] }
}

export interface AuthWindowParams {
  internetAccountId: string
  data: { redirect_uri: string }
  url: string
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
  // list-only removal (leaves any on-disk file intact) for pruning a recent
  // entry whose session file no longer loads
  removeRecentSession: { args: [sessionPath: string]; return: void }
  renameSession: { args: [sessionPath: string, newName: string]; return: void }
  showItemInFolder: { args: [sessionPath: string]; return: void }
  // Whether a session is open and therefore has edits worth flushing before the
  // window goes away. The main process gates `close` on this: with no session
  // (the start screen) there is nothing to wait for and the window closes at
  // once, which is also the state it falls back to if the renderer dies.
  setSessionOpen: { args: [open: boolean]; return: void }
  // The renderer's answer to a flushSessionForClose push: the session has been
  // written (or failed to write), so the close may proceed.
  sessionFlushed: { args: []; return: void }
  loadThumbnail: { args: [name: string]; return: string | undefined }
  reset: { args: []; return: void }
  listQuickstarts: { args: []; return: string[] }
  addToQuickstartList: {
    args: [sessionPath: string, sessionName: string]
    return: void
  }
  // a quickstart is a copy of a saved session, so the same file shape
  getQuickstart: { args: [name: string]; return: SessionSnap }
  deleteQuickstart: { args: [name: string]; return: void }
  renameQuickstart: { args: [oldName: string, newName: string]; return: void }
  // plugins the user installs for every session, merged into each config's own
  // plugin list at load time
  getGlobalPlugins: { args: []; return: unknown[] }
  setGlobalPlugins: { args: [plugins: unknown[]]; return: void }
  openAuthWindow: {
    args: [params: AuthWindowParams]
    return: string | undefined
  }
  // Asks the user to vouch for plugins that aren't in the plugin store, before
  // a link-supplied config gets to run their javascript. Native+modal rather
  // than a React dialog so it can't be missed and needs no plumbing through the
  // async session-load path.
  confirmUntrustedPlugins: {
    args: [plugins: { description: string; url: string }[]]
    return: boolean
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
