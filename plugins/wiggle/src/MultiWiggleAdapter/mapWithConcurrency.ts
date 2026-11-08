/**
 * `Promise.all(items.map(fn))` with at most `limit` in flight, results in input
 * order. The first rejection rejects the call, before the aborts it causes
 * settle: items not yet started never start, and the signal each call gets
 * aborts, so the ones in flight stop at the socket. That signal also follows
 * `parent`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, signal: AbortSignal) => Promise<R>,
  parent?: AbortSignal,
): Promise<R[]> {
  const failed = new AbortController()
  const signal = parent
    ? AbortSignal.any([parent, failed.signal])
    : failed.signal
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    for (let i = next++; i < items.length; i = next++) {
      try {
        results[i] = await fn(items[i]!, signal)
      } catch (e) {
        next = items.length
        failed.abort()
        throw e
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  )
  return results
}
