/**
 * `Promise.all(items.map(fn))` with at most `limit` in flight, results in input
 * order. The first rejection rejects the call, and items not yet started never
 * start.
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
      try {
        results[i] = await fn(items[i]!, i)
      } catch (e) {
        next = items.length
        throw e
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  )
  return results
}
