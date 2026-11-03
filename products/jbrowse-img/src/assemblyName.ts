import type { Assembly } from './types.ts'

/** The assembly a name means: its own name or one of its `aliases`. */
export function findAssembly(assemblies: readonly Assembly[], name: string) {
  return assemblies.find(a => a.name === name || a.aliases?.includes(name))
}

export function canonicalAssemblyName(
  assemblies: readonly Assembly[],
  name: string,
) {
  return findAssembly(assemblies, name)?.name ?? name
}
