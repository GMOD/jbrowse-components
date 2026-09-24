/** The budget each stage of the ready chain gets unless told otherwise. */
export const DEFAULT_TIMEOUT = 60000

export const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * Poll `read` until it has answered true for `holdMs` without a break, or
 * `timeout` runs out. A `read` that throws ends the wait with its error.
 * Polled from Node because Chrome throttles in-page timers in a background
 * tab, which is what a headless page is.
 */
export async function holdTrue(
  read: () => Promise<boolean>,
  {
    holdMs,
    timeout,
    pollMs,
  }: { holdMs: number; timeout: number; pollMs: number },
): Promise<boolean> {
  const deadline = Date.now() + timeout
  let since: number | undefined
  while (Date.now() < deadline) {
    const ok = await read()
    const now = Date.now()
    if (ok) {
      since ??= now
      if (now - since >= holdMs) {
        return true
      }
    } else {
      since = undefined
    }
    await delay(pollMs)
  }
  return false
}
