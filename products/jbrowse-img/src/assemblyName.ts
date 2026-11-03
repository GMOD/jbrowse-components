import type { Assembly } from './types.ts'

/** The assembly a name means: one named so, else one aliasing it. */
export function findAssembly(assemblies: readonly Assembly[], name: string) {
  return (
    assemblies.find(a => a.name === name) ??
    assemblies.find(a => a.aliases?.includes(name))
  )
}
