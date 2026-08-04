// jsdom implements neither requestIdleCallback nor cancelIdleCallback, so
// `@jbrowse/core/util`'s rIC would otherwise fall back to a setTimeout. This
// shim runs the callback *synchronously* instead of deferring it, which is what
// tests want: rIC's caller is doAnalytics, and a deferred write fires after the
// test that triggered it has finished — fetching and logging from a realm jest
// has already torn down. Running it inline keeps the analytics request on the
// same tick as the load that caused it.
//
// It must be a setupFile (not setupFilesAfterEnv): rIC is resolved once at
// module-eval time, so the shim has to be installed before the module graph is
// imported.
if (typeof window !== 'undefined' && !window.requestIdleCallback) {
  window.requestIdleCallback = cb => {
    cb({ didTimeout: false, timeRemaining: () => 0 })
    return 0
  }
  window.cancelIdleCallback = () => {}
}
