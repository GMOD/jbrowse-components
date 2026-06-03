// minimal nested setter, replaces the `set-value` dependency. Splits the dot
// path and creates intermediate objects as needed, mirroring ./get-value.ts
export default function setValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const segs = path.split('.')
  const last = segs.pop()!
  let obj = target
  for (const seg of segs) {
    if (typeof obj[seg] !== 'object' || obj[seg] === null) {
      obj[seg] = {}
    }
    obj = obj[seg] as Record<string, unknown>
  }
  obj[last] = value
}
