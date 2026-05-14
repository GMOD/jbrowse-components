function isStrs(array: unknown[]): array is string[] {
  return typeof array[0] === 'string'
}

export function normalize(
  r: string[] | { id: string; label?: string; color?: string }[],
) {
  return isStrs(r)
    ? r.map(elt => ({
        id: elt,
        label: elt,
        color: undefined,
      }))
    : r
}
