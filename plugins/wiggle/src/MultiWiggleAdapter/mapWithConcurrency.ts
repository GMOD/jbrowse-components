/**
 * `Promise.all(items.map(fn))` with at most `limit` of them in flight, results
 * in input order.
 *
 * Rejection behaves as `Promise.all` does — the first rejection rejects the
 * whole call — with the one difference that items not yet started never start,
 * which is the point of having a queue at all.
 *
 * Kept local rather than pulled from `p-limit`: it is fifteen lines, and
 * `@jbrowse/plugin-wiggle` is published, so a runtime dependency here lands in
 * everyone's bundle. Promote it to `@jbrowse/core/util` if a second caller
 * appears.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!, i)
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  )
  return results
}
