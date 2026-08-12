// The guard both Web Storage stores need, written once.
//
// Every accessor built here is *total*: it falls back rather than throwing.
// That is not defensiveness for its own sake — the callers are MobX autoruns
// persisting a setting and state-model actions caching a token, and there a
// throw is doubly bad. It skips the writes queued behind it in the same autorun
// body (the LGV persists six keys in a row, the hierarchical track selector
// seven), and MobX reports it as an uncaught reaction error on every subsequent
// tick.
//
// Three separate ways this can fail, and only the first is the obvious one:
//
// - no store global at all — an RPC worker, SSR.
// - reading the global THROWS rather than being undefined: a cross-origin
//   iframe with third-party storage blocked, or Safari with cookies disabled.
//   `typeof localStorage` invokes the same getter, so even the probe has to be
//   guarded — which is also why a `typeof … === 'undefined'` probe is not a way
//   to ask whether you are in a worker. This is the embedded-product case
//   (`@jbrowse/react-*` on someone else's page), where it is also the least
//   likely to be noticed by us.
// - the store exists and reads fine, but `setItem` throws: quota exhausted, or
//   Safari private browsing, which refuses every write.

export interface GuardedStorage {
  /**
   * Whether there is a store to persist to at all — the first two failures
   * above, both of which are decided once for the page.
   *
   * Every accessor is safe without asking; what this answers is the different
   * question of whether persistence is *real*. With no store, a write is
   * dropped and the matching read answers the default, so a caller that
   * round-trips a value through a key (rather than merely saving one) has to
   * know, or it reads back its own default and calls it the stored value.
   */
  available: () => boolean
  /** The raw string stored at `key`, or undefined if absent or unreadable. */
  getItem: (key: string) => string | undefined
  /**
   * Returns whether the store took the value. Nearly every caller ignores that
   * — a setting that could not be persisted is not worth interrupting anyone
   * over — but a caller that reads the key back to learn the current value
   * needs to know that the read will not reflect this write.
   */
  setItem: (key: string, value: string) => boolean
  /** Returns whether the store took the removal; see {@link setItem}. */
  removeItem: (key: string) => boolean
}

/**
 * `read` names the global rather than being handed it, so resolving it can be
 * deferred past module load and wrapped in the try that the read itself needs.
 * `label` only ever reaches the one warning below.
 */
function guardedStorage(read: () => Storage, label: string): GuardedStorage {
  // Resolved once. `null` means "checked, unavailable" — distinct from the
  // `undefined` that means "not checked yet".
  let store: Storage | null | undefined

  function getStore() {
    if (store === undefined) {
      try {
        store = read()
      } catch {
        store = null
      }
    }
    return store ?? undefined
  }

  // One warning per page per store, not one per failed write: the autoruns that
  // persist settings re-run on every change, so a persistent failure (quota,
  // private browsing) would otherwise fill the console with the same line. Same
  // doctrine as the `savingFailed` latch in jbrowse-web's session autosave.
  let warnedOnWrite = false

  return {
    available: () => getStore() !== undefined,
    getItem(key) {
      try {
        return getStore()?.getItem(key) ?? undefined
      } catch {
        return undefined
      }
    },
    setItem(key, value) {
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
            `Unable to persist to ${label} (key "${key}"); further failures are not reported`,
            e,
          )
        }
        return false
      }
    },
    removeItem(key) {
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
    },
  }
}

export const guardedLocalStorage = guardedStorage(
  () => localStorage,
  'localStorage',
)

export const guardedSessionStorage = guardedStorage(
  () => sessionStorage,
  'sessionStorage',
)
