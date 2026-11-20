export const TRANSMISSION_SEXES = ['male', 'female', 'other'] as const

export const TRANSMISSION_PARENTS = ['mother', 'father', 'either'] as const

export interface TransmissionEntry {
  refName?: string
  sex?: (typeof TRANSMISSION_SEXES)[number]
  from: (typeof TRANSMISSION_PARENTS)[number]
}

/**
 * The entries of an assembly's `transmission` slot that apply to `refName`:
 * those naming it, canonically or by any alias, and those naming no refName,
 * in the slot's order. `assembly` resolves both sides to canonical names, so
 * an entry written `NC_000023.11` applies to `chrX` and the other way round.
 */
export function transmissionEntriesFor<T extends TransmissionEntry>(
  entries: readonly T[],
  refName: string,
  assembly: { getCanonicalRefName2: (refName: string) => string },
) {
  const canonical = assembly.getCanonicalRefName2(refName)
  return entries.filter(
    entry =>
      entry.refName === undefined ||
      assembly.getCanonicalRefName2(entry.refName) === canonical,
  )
}
