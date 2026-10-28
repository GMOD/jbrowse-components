/**
 * Shared `.catch(logError)` handler for fire-and-forget promises whose only
 * failure handling is logging.
 */
export function logError(e: unknown) {
  console.error(e)
}

/**
 * Runs each job after the one before it has settled. A failing job does not
 * block the ones behind it; its rejection reaches its own caller only.
 */
export function createQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn)
    tail = run.catch(() => {})
    return run
  }
}
