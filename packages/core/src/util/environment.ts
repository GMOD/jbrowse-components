// Which JS environment we are running in, plus the idle-callback shim that
// depends on it. Deliberately dependency-free and separate from the `util`
// barrel: `util/io` needs `isElectron`/`isNode`, and importing them from the
// barrel dragged the whole of `@jbrowse/core/util` — MST, the configuration
// system, MUI — into anything that opened a file.

export const isElectron = /electron/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : '',
)

// equivalent to the `detect-node` package: true only inside a real Node.js
// process, not in browsers where `process` may be polyfilled by the bundler
// (the toString brand is '[object process]' only for the genuine global).
// `process` isn't in core's browser-targeted build lib, so read it off
// globalThis rather than referencing the bare global
export const isNode =
  Object.prototype.toString.call(
    (globalThis as { process?: unknown }).process,
  ) === '[object process]'

// Whether there is an IndexedDB to open. The two callers gate on it rather than
// catching, so the absence stays silent: opening it anyway throws a
// ReferenceError that reads like a real failure, and that is the reason every
// test run had to filter "indexedDB" out of console.error wholesale.
//
// Guarded like the Web Storage globals (see util/webStorage.ts): a bare
// `typeof indexedDB` invokes the same getter, which throws rather than answering
// in a cross-origin iframe with third-party storage blocked. So the probe that
// exists to avoid a throw was itself the throw, in the one environment where it
// matters — an embedded product on someone else's page.
export function indexedDBAvailable() {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

// the real idle callback where the realm has one, otherwise a short timeout.
// jsdom has neither, so tests install a synchronous shim
// (config/jest/requestIdleCallback.js) rather than this branching on the
// environment
export const rIC =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  typeof window !== 'undefined' && window.requestIdleCallback
    ? window.requestIdleCallback
    : (cb: () => void) => {
        setTimeout(() => {
          cb()
        }, 1)
      }
