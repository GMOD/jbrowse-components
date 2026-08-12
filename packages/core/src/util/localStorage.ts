// Every accessor here is *total*: it falls back to the default rather than
// throwing. That is not defensiveness for its own sake — nearly every caller is
// a MobX autorun persisting a setting, and there a throw is doubly bad. It skips
// the writes queued behind it in the same autorun body (the LGV persists six
// keys in a row, the hierarchical track selector seven), and MobX reports it as
// an uncaught reaction error on every subsequent tick.
//
// Three separate ways this can fail, and only the first is the obvious one:
//
// - no `localStorage` global at all — an RPC worker, SSR.
// - reading `localStorage` THROWS rather than being undefined: a cross-origin
//   iframe with third-party storage blocked, or Safari with cookies disabled.
//   `typeof localStorage` invokes the same getter, so even the probe has to be
//   guarded. This is the embedded-product case (`@jbrowse/react-*` on someone
//   else's page), where it is also the least likely to be noticed by us.
// - the store exists and reads fine, but `setItem` throws: quota exhausted, or
//   Safari private browsing, which refuses every write.

// Resolved once. `null` means "checked, unavailable" — distinct from the
// `undefined` that means "not checked yet".
let store: Storage | null | undefined

function getStore() {
  if (store === undefined) {
    try {
      store = typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      store = null
    }
  }
  return store ?? undefined
}

/**
 * Whether there is a store to persist to at all — the first two failures above,
 * both of which are decided once for the page.
 *
 * Every accessor here is safe without this; what it answers is the different
 * question of whether persistence is *real*. With no store, a write is dropped
 * and the matching read answers the default, so a caller that round-trips a
 * value through a key (rather than merely saving one) has to know, or it reads
 * back its own default and calls it the stored value. `useLocalStorage` is that
 * caller.
 */
export function localStorageAvailable() {
  return getStore() !== undefined
}

// One warning per page, not one per failed write: the autoruns that persist
// settings re-run on every change, so a persistent failure (quota, private
// browsing) would otherwise fill the console with the same line. Same doctrine
// as the `savingFailed` latch in jbrowse-web's session autosave.
let warnedOnWrite = false

/** The raw string stored at `key`, or undefined if absent or unreadable. */
export function localStorageGetItem(key: string) {
  try {
    return getStore()?.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Returns whether the store took the value. Nearly every caller ignores that —
 * a setting that could not be persisted is not worth interrupting anyone over —
 * but a caller that reads the key back to learn the current value needs to know
 * that the read will not reflect this write.
 */
export function localStorageSetItem(key: string, value: string) {
  const s = getStore()
  if (!s) {
    return false
  }
  try {
    s.setItem(key, value)
    return true
  } catch (e) {
    if (!warnedOnWrite) {
      warnedOnWrite = true
      console.warn(
        `Unable to persist settings to localStorage (key "${key}"); further failures are not reported`,
        e,
      )
    }
    return false
  }
}

/** Returns whether the store took the removal; see {@link localStorageSetItem}. */
export function localStorageRemoveItem(key: string) {
  const s = getStore()
  if (!s) {
    return false
  }
  try {
    s.removeItem(key)
    return true
  } catch {
    // nothing useful to do: the value we wanted gone is unreachable anyway
    return false
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
