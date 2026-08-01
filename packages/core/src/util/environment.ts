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

// requires immediate execution in jest environment, because (hypothesis) it
// otherwise listens for prerendered_canvas but reads empty pixels, and doesn't
// get the contents of the canvas
export const rIC =
  typeof jest === 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      typeof window !== 'undefined' && window.requestIdleCallback
      ? window.requestIdleCallback
      : (cb: () => void) => {
          setTimeout(() => {
            cb()
          }, 1)
        }
    : (cb: () => void) => {
        cb()
      }
