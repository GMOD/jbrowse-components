// Temporary perf/OOM instrumentation for diagnosing LGVSyntenyDisplay slowness
// and the coverage-buffer device-limit crash. Both the RPC worker and the
// main-thread renderer import this module, so the single ALIGNMENTS_PERF flag
// toggles logging in both contexts at once. Flip to false to silence.
// let widens the inferred type to boolean (const would narrow to the literal
// `true`, making every `if (ALIGNMENTS_PERF)` below a false-positive "always
// truthy" lint error)
// eslint-disable-next-line prefer-const
export let ALIGNMENTS_PERF = true

export function perfLog(...args: unknown[]) {
  if (ALIGNMENTS_PERF) {
    // eslint-disable-next-line no-console
    console.log('[alignments-perf]', ...args)
  }
}

// Time an async phase and log its wall-clock duration. Returns the phase's
// result unchanged so it can wrap a call site inline.
export async function perfTime<T>(label: string, fn: () => Promise<T>) {
  if (ALIGNMENTS_PERF) {
    const start = performance.now()
    const result = await fn()
    perfLog(`${label}: ${(performance.now() - start).toFixed(1)}ms`)
    return result
  } else {
    return fn()
  }
}

// Synchronous variant of perfTime for timing non-async sub-phases.
export function perfTimeSync<T>(label: string, fn: () => T) {
  if (ALIGNMENTS_PERF) {
    const start = performance.now()
    const result = fn()
    perfLog(`${label}: ${(performance.now() - start).toFixed(1)}ms`)
    return result
  } else {
    return fn()
  }
}

export function fmtBytes(bytes: number) {
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(1)}KB`
}
