// Bounded-concurrency map, used by the driver to compile shaders in parallel.
//
// It lives here rather than in build-shaders.ts because that file is a CLI
// script: importing it downloads slangc, probes the validators and runs the
// build. Nothing that executes on import can be unit-tested, and the error
// semantics below are exactly the part worth pinning.

/**
 * Run `fn` over `items` with at most `limit` in flight.
 *
 * Every item runs even if an earlier one throws — one broken shader must not
 * hide the other broken shaders, which is the difference between one round of
 * fixing and five. Errors come back in `items` order rather than completion
 * order, so the report a build prints is stable across runs even though the
 * work finishes in whatever order the machine happens to produce.
 */
export async function pool<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  const errors: { index: number; item: T; error: unknown }[] = []
  let next = 0
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) {
      try {
        await fn(items[i]!)
      } catch (error) {
        errors.push({ index: i, item: items[i]!, error })
      }
    }
  }
  // `Math.min` matters for more than tidiness: `Array.from({length: limit})`
  // with a limit above the item count spawns workers that find the queue empty
  // and return, which is harmless — but on an EMPTY item list it would still be
  // `limit` promises, and the empty-input case is the one a caller hits by
  // accident.
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
  return errors.sort((a, b) => a.index - b.index)
}
