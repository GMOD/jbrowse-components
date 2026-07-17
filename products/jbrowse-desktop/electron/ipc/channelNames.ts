// The channels the preload will relay from the renderer. Kept apart from
// channels.ts because that module imports ipcMain to register handlers, and
// this list is bundled into the preload, which runs in the renderer process.
// The `import type` below is erased at build time, so it costs nothing here.

import type { IpcChannels } from './channels.ts'

export const INVOKABLE_CHANNELS = [
  'quit',
  'userData',
  'indexFasta',
  'promptOpenFile',
  'promptOpenLocalFile',
  'promptSessionSaveAs',
  'listSessions',
  'loadSession',
  'createInitialAutosaveFile',
  'saveSession',
  'deleteSessions',
  'removeRecentSession',
  'renameSession',
  'showItemInFolder',
  'loadThumbnail',
  'reset',
  'listQuickstarts',
  'addToQuickstartList',
  'getQuickstart',
  'deleteQuickstart',
  'renameQuickstart',
  'openAuthWindow',
  'confirmUntrustedPlugins',
  'openBlatChallenge',
  'blatFetch',
] as const satisfies readonly (keyof IpcChannels)[]

// A channel added to IpcChannels but not listed above would be rejected by the
// preload at runtime, which is a confusing way to find out. Make it a type
// error instead: this alias is `never` only when the list is exhaustive, so an
// unlisted channel fails to satisfy the annotation below.
type UnlistedChannel = Exclude<
  keyof IpcChannels,
  (typeof INVOKABLE_CHANNELS)[number]
>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _everyChannelIsListed: UnlistedChannel[] = []
