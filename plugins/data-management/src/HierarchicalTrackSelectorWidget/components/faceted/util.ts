export function getRootKeys(obj: Record<string, unknown>) {
  return Object.entries(obj)
    .map(([key, val]) => (typeof val === 'string' ? key : ''))
    .filter(f => !!f)
}
