/**
 * name -> item for every name an assembly answers to. An assembly's own name
 * beats another assembly's alias, and otherwise the first to claim a name keeps
 * it, so the answer never depends on which array an assembly sits in.
 */
export function indexAssemblyNames<T>(
  items: Iterable<T>,
  namesOf: (item: T) => { name: string; aliases: readonly string[] },
) {
  const index = new Map<string, T>()
  const named = Array.from(items, item => ({ item, ...namesOf(item) }))
  for (const { item, name } of named) {
    if (!index.has(name)) {
      index.set(name, item)
    }
  }
  for (const { item, aliases } of named) {
    for (const alias of aliases) {
      if (!index.has(alias)) {
        index.set(alias, item)
      }
    }
  }
  return index
}
