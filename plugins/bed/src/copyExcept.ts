// `const { a, b, ...rest } = data` in the same key order, which measured
// slower on every BED line shape (benches/featureData.bench.ts)
export function copyExcept(
  data: Record<string, unknown>,
  excluded: ReadonlySet<string>,
) {
  const out: Record<string, unknown> = {}
  for (const key in data) {
    if (!excluded.has(key)) {
      out[key] = data[key]
    }
  }
  return out
}
