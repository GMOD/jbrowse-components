// The channels the preload will relay from the renderer. Kept apart from
// channels.ts because that module imports ipcMain to register handlers, and
// this list is bundled into the preload, which runs in the renderer process.
// The `import type` below is erased at build time, so it costs nothing here.

import type { IpcChannels } from './channelTypes.ts'

export const INVOKABLE_CHANNELS = [
  'quit',
  'userData',
  'indexFasta',
  'cancelIndexFasta',
  'promptOpenFile',
  'promptOpenLocalFile',
  'promptSessionSaveAs',
  'listSessions',
  'loadSession',
  'newAutosavePath',
  'saveSession',
  'deleteSessions',
  'removeRecentSession',
  'renameSession',
  'showItemInFolder',
  'setSessionOpen',
  'sessionFlushed',
  'loadThumbnail',
  'reset',
  'listQuickstarts',
  'addToQuickstartList',
  'getQuickstart',
  'deleteQuickstart',
  'renameQuickstart',
  'getGlobalPlugins',
  'setGlobalPlugins',
  'openAuthWindow',
  'confirmUntrustedPlugins',
  'openBlatChallenge',
  'blatFetch',
  'mcpResponse',
  'mcpReady',
] as const satisfies readonly (keyof IpcChannels)[]

// A channel added to IpcChannels but not listed above would be rejected by the
// preload at runtime, which is a confusing way to find out. Make it a type
// error instead: this alias is `never` only when the list is exhaustive.
type UnlistedChannel = Exclude<
  keyof IpcChannels,
  (typeof INVOKABLE_CHANNELS)[number]
>

// Constrained to `never`, so an unlisted channel is an error that names it.
//
// NOT `const _: UnlistedChannel[] = []`, which is what this was and which never
// checked anything: an empty array literal is assignable to every array type,
// `never[]` included, so the guard passed with `setSessionOpen` and
// `sessionFlushed` missing from the list for as long as they have existed. The
// constraint has to sit somewhere a non-`never` union cannot satisfy.
type AssertNever<T extends never> = T

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _EveryChannelIsListed = AssertNever<UnlistedChannel>
