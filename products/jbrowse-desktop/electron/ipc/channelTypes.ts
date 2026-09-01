// The contract between the two processes: every channel, its arguments, and
// what it resolves to. Both sides depend on this and neither owns it, so it is
// deliberately import-free — no `electron`, no `node:*`, nothing from
// @jbrowse/core. That is what lets the renderer (src/ipc.ts, compiled for the
// browser) and the main process (channels.ts, which needs ipcMain) share one
// definition instead of each restating it.
//
// Keep it that way: an import here would drag the main process's module graph
// into the web typecheck, or the DOM lib into the electron one.
//
// It also holds the few plain constants both processes have to agree on. Those
// make it a real module in the renderer bundle rather than one erased with its
// `import type` — which costs nothing precisely because of the rule above: with
// no imports of its own, the module brings nothing along with it.

/**
 * The userData subdirectory text-indexing writes its trix output into.
 *
 * Here because both processes need it and neither can import the other's copy:
 * the renderer builds the output path (it holds the job), and the main process
 * has to know the directory in order to clear it on a factory reset. Two
 * spellings of one literal is how it came to be written by one and cleaned up by
 * neither.
 */
export const NAME_INDICES_DIR = 'nameIndices'

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
 * A file the user asked to open, plus where the session built from it must be
 * saved. The two are not always the same file: opening a *config* gives the
 * session an autosave of its own, because writing it back would destroy the
 * config (see the `loadSession` handler).
 */
export interface LoadedSession {
  snap: SessionSnap
  sessionPath: string
}

/**
 * What a launch (argv, an OS open-file, or a jbrowse:// link) asks the app to
 * open.
 *
 * Lives here, rather than in launchTarget.ts where it is produced, because it
 * crosses to the renderer on the openLaunchTarget push below — and this file is
 * the import-free side of that boundary. launchTarget.ts imports `node:path`,
 * so pointing the channel definition at it would drag the main process's module
 * graph into the renderer's typecheck, which is the thing the note at the top
 * of this file exists to prevent.
 */
export type LaunchTarget =
  | { type: 'file'; path: string }
  // a JBrowse Web https link, unwrapped from a jbrowse:// url
  | { type: 'link'; url: string }

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
  // Sent when a launch arrives while a session is already open, INSTEAD of
  // navigating the window to it. The renderer flushes what it has and swaps the
  // plugin manager in place, the same as the in-app "Open JBrowse Web link..."
  // does. See the comment on ensureWindow for why the navigating route is still
  // the right one when no session is open.
  openLaunchTarget: { args: [target: LaunchTarget] }
  // An MCP tool call whose subject is the session model. Answered by an
  // mcpResponse invoke carrying the request's id.
  mcpRequest: { args: [request: McpBridgeRequest] }
}

export interface AuthWindowParams {
  internetAccountId: string
  data: { redirect_uri: string }
  url: string
}

/**
 * One MCP tool call the bridge is relaying to the renderer, which is where the
 * session model lives. `id` correlates the mcpResponse coming back — the push
 * direction has no reply of its own (see IpcPushChannels), so the answer is an
 * invoke in the other direction carrying the same id.
 */
export interface McpBridgeRequest {
  id: number
  tool: string
  args: Record<string, unknown>
}

export interface McpBridgeResponse {
  id: number
  result?: unknown
  error?: string
}

export interface IpcChannels {
  quit: { args: []; return: void }
  userData: { args: []; return: string }
  // A FASTA with no .fai is read end to end, and a remote one is downloaded in
  // full first, so this is the one handler that can hold a dialog for minutes.
  // `jobId` is the caller's handle on that run: cancelIndexFasta takes the same
  // one, so a dialog the user dismissed mid-index stops the read rather than
  // leaving it going with nothing waiting on it.
  indexFasta: {
    args: [location: { uri: string } | { localPath: string }, jobId: string]
    return: string
  }
  cancelIndexFasta: { args: [jobId: string]; return: void }
  promptOpenFile: { args: []; return: string | undefined }
  promptOpenLocalFile: {
    args: [defaultDir?: string]
    return: string | undefined
  }
  promptSessionSaveAs: { args: []; return: string | undefined }
  listSessions: { args: []; return: RecentSessionInfo[] }
  loadSession: { args: [filePath: string]; return: LoadedSession }
  // Where a session the renderer assembled for itself (a hub launch, a
  // quickstart merge, a jbrowse:// link) should save. Only allocates a name —
  // the first autosave writes the file and lists it, so a launch that fails
  // before then leaves nothing behind.
  newAutosavePath: { args: []; return: string }
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
  // The renderer's answer to an mcpRequest push
  mcpResponse: { args: [response: McpBridgeResponse]; return: void }
  // The renderer announcing that its mcpRequest listener is subscribed. A push
  // to a page with no listener is discarded silently and never retried, so the
  // bridge holds relays until this arrives rather than spending the whole relay
  // timeout on a message nobody received. `install` is a fresh id per installed
  // plugin manager, giving `open` something that changes on every load — the
  // session's own id is persisted, so reopening a saved session restores it
  // unchanged and says nothing about whether the load happened.
  mcpReady: { args: [state: { install: string }]; return: void }
}
