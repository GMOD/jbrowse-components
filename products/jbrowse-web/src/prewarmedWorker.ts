import makeWorkerInstance from './makeWorkerInstance.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

let early:
  | { worker: Worker; failed: boolean; stop: AbortController }
  | undefined

/**
 * Start the first RPC worker from main.js, so its bundle downloads beside the
 * config and the app's own chunks instead of after the session is built. The
 * pool adopts it through {@link takeWorker}, and the driver sends it the plugin
 * list once the root model has settled which plugins are trusted.
 */
export function prewarmWorker() {
  const worker = makeWorkerInstance()
  const stop = new AbortController()
  const entry = { worker, failed: false, stop }
  worker.addEventListener(
    'error',
    () => {
      entry.failed = true
    },
    { signal: stop.signal },
  )
  early = entry
}

/**
 * Name the plugins this page is about to load to the early worker, which
 * downloads them and its re-export registry while the page evaluates them and
 * builds the session. Its boot configuration is sent only after that.
 */
export function hintPrewarmedWorker(plugins: PluginDefinition[]) {
  early?.worker.postMessage({
    message: 'preloadPlugins',
    hint: { plugins, windowHref: window.location.href },
  })
}

/** The pool's worker factory: the early worker first, if it loaded */
export function takeWorker() {
  const entry = early
  early = undefined
  entry?.stop.abort()
  if (entry && !entry.failed) {
    return entry.worker
  }
  entry?.worker.terminate()
  return makeWorkerInstance()
}

/** For a root model that runs RPC on the main thread */
export function discardPrewarmedWorker() {
  early?.stop.abort()
  early?.worker.terminate()
  early = undefined
}
