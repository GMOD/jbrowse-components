// localStorage: the guarded primitives from webStorage.ts (read that file for
// the three ways a Web Storage store fails and why every accessor here is
// total), plus the typed reads and the key subscription, which only this store
// has callers for.
import { guardedLocalStorage } from './webStorage.ts'

export const {
  available: localStorageAvailable,
  getItem: localStorageGetItem,
  setItem: localStorageSetItem,
  removeItem: localStorageRemoveItem,
} = guardedLocalStorage

// Watchers of a key, and the one `storage` listener they share.
//
// Two different events reach them, which is why this is not simply a `storage`
// listener at each call site. Another TAB writing the key raises `storage` —
// but never in the tab that wrote it, so a write from THIS tab reaches nobody
// and has to be announced by hand. Missing that half is what let two components
// on one key show different values until one of them remounted.
//
// Announcing is deliberately not folded into localStorageSetItem. The
// grid-bookmark widget persists its list from an autorun over the list, so a
// write that called its own subscriber back would re-enter that autorun and
// write again, forever. A writer says when its write is news.
const listeners = new Map<string, Set<() => void>>()

// Installed on the first subscription rather than at module scope, so importing
// this file from a worker or a test never touches `window`.
let storageListenerInstalled = false

function installStorageListener() {
  if (storageListenerInstalled || typeof window === 'undefined') {
    return
  }
  storageListenerInstalled = true
  window.addEventListener('storage', e => {
    // sessionStorage raises the same event on the same window, and jbrowse-web
    // mirrors whole sessions into it
    if (e.storageArea !== window.localStorage) {
      return
    }
    if (e.key === null) {
      // a clear(): a factory reset, a test's teardown. Every key at once
      for (const k of [...listeners.keys()]) {
        notifyLocalStorageKey(k)
      }
    } else if (listeners.has(e.key)) {
      notifyLocalStorageKey(e.key)
    }
  })
}

/**
 * Call `fn` whenever `key` changes — in another tab, or here via
 * {@link notifyLocalStorageKey}. Returns the unsubscribe.
 *
 * `fn` takes no argument on purpose: it is told that the key changed, and reads
 * the store itself. A payload would be a second copy of the value, and a
 * `clear()` has none to hand over.
 */
export function subscribeToLocalStorageKey(key: string, fn: () => void) {
  installStorageListener()
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(fn)
  return () => {
    set.delete(fn)
    if (!set.size) {
      listeners.delete(key)
    }
  }
}

/** Announce a write made in this tab, which `storage` never reports back. */
export function notifyLocalStorageKey(key: string) {
  for (const fn of listeners.get(key) ?? []) {
    fn()
  }
}

export function localStorageGetNumber(key: string, defaultVal: number) {
  const stored = localStorageGetItem(key)
  // rejected before the coercion rather than after it: `+''` is 0, so an entry
  // written as the empty string would otherwise read back as a real 0 instead
  // of falling back. isFinite rather than !isNaN so 'Infinity' falls back too —
  // every one of these is a pixel width or a base-pair count.
  if (!stored) {
    return defaultVal
  }
  const parsed = +stored
  return Number.isFinite(parsed) ? parsed : defaultVal
}

export function localStorageGetJSON<T>(key: string, defaultVal: T): T {
  const stored = localStorageGetItem(key)
  if (stored) {
    try {
      return JSON.parse(stored) as T
    } catch (e) {
      console.warn(`Invalid localStorage value for ${key}:`, stored, e)
    }
  }
  return defaultVal
}

/**
 * The list of strings at `key` — absent, unreadable, malformed, or holding
 * anything else all read as empty.
 *
 * The element filter is the part {@link localStorageGetJSON} cannot do: a
 * stored array of the wrong element type parses fine and then behaves as a list
 * of values that match nothing, which looks the same as an empty list except
 * that it is never noticed. Three keys wanted exactly this and each spelled it
 * out — hidden facet columns, trusted plugin URLs, and the desktop safe-mode
 * marker, which additionally has to survive the bare `1` older builds wrote
 * there.
 */
export function localStorageGetStringArray(key: string) {
  const parsed = localStorageGetJSON<unknown>(key, [])
  return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : []
}

/**
 * Writes `val` as JSON, except when it is null/undefined — those are skipped
 * rather than stored, so a tri-state setting whose "unset" value means "follow
 * the config" leaves whatever was there instead of pinning `null` over it.
 */
export function localStorageSetJSON(key: string, val: unknown) {
  if (val !== undefined && val !== null) {
    localStorageSetItem(key, JSON.stringify(val))
  }
}

export function localStorageGetBoolean(key: string, defaultVal: boolean) {
  const stored = localStorageGetJSON<unknown>(key, defaultVal)
  // falls back rather than coercing when the key holds something that is not a
  // boolean (an older build's format, a hand-edited value). `Boolean(null)` is
  // false, which would silently override a `true` default — which is what most
  // of these are.
  return typeof stored === 'boolean' ? stored : defaultVal
}

export function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}

export function localStorageSetNumber(key: string, value: number) {
  localStorageSetItem(key, JSON.stringify(value))
}
