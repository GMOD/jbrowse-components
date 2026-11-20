import { transmissionEntriesFor } from '@jbrowse/core/assemblyManager'

import type { TransmissionEntry } from '@jbrowse/core/assemblyManager'

interface RefNameResolver {
  getCanonicalRefName2: (refName: string) => string
}

/**
 * Each region's transmission rule: the assembly's `entries` that hold for
 * its refName, resolved through the assembly's aliases on the main thread,
 * since a worker has no assembly to resolve them against.
 */
export function regionTransmission<T extends TransmissionEntry>(
  entries: readonly T[],
  regions: readonly { refName: string }[],
  assembly: RefNameResolver,
) {
  return regions.map(region =>
    transmissionEntriesFor(entries, region.refName, assembly),
  )
}

/**
 * The `transmission` argument a fetch over `regions` sends: each region's
 * rule under its own assembly, in `regions` order, or nothing while no trio
 * asks for a Mendelian check, so a track with no pedigree sends what it
 * always did. A region whose assembly is unknown takes no entry, the
 * autosomal rule.
 */
export function transmissionArg({
  trios,
  entries,
  regions,
  assemblyOf,
}: {
  trios: readonly unknown[]
  entries: readonly TransmissionEntry[]
  regions: readonly { assemblyName: string; refName: string }[]
  assemblyOf: (assemblyName: string) => RefNameResolver | undefined
}) {
  return trios.length > 0
    ? regions.map(region => {
        const assembly = assemblyOf(region.assemblyName)
        return assembly
          ? transmissionEntriesFor(entries, region.refName, assembly)
          : []
      })
    : undefined
}

/**
 * An assembly's `transmission` entries as plain objects, read off the live
 * configuration nodes, whose `from` default a snapshot would leave out.
 */
export function plainTransmission(entries: readonly TransmissionEntry[]) {
  return entries.map(({ refName, sex, from }) => ({
    ...(refName === undefined ? {} : { refName }),
    ...(sex === undefined ? {} : { sex }),
    from,
  }))
}
