// minimal nested getter, mirroring ./set-value.ts
export default function getValue(
  target: Record<string, unknown>,
  path: string,
) {
  let value: unknown = target
  for (const seg of path.split('.')) {
    if (typeof value !== 'object' || value === null) {
      return undefined
    }
    value = (value as Record<string, unknown>)[seg]
  }
  return value
}
