// sessionStorage, guarded exactly as localStorage is — see webStorage.ts for
// the three ways a Web Storage store fails.
//
// This store holds the internet-account access tokens, which is a per-tab cache
// of something the user can always be asked for again. So a store that refuses
// to be read or written costs an extra auth prompt, and a throw out of
// `storeToken` takes the whole auth flow down instead — in the embedded
// products, on someone else's page, which is where third-party storage is
// blocked in the first place.
//
// Deliberately no `sessionStorageSetJSON` / `…GetJSON` twins: jbrowse-web's
// session mirror is the other caller, and it *wants* the quota throw so it can
// tell the user its autosave has stopped working.
import { guardedSessionStorage } from './webStorage.ts'

export const {
  available: sessionStorageAvailable,
  getItem: sessionStorageGetItem,
  setItem: sessionStorageSetItem,
  removeItem: sessionStorageRemoveItem,
} = guardedSessionStorage
