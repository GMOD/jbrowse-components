/**
 * What the action showing an assembly's whole genome says it shows: its
 * chromosomes where the assembly knows them, else every region it has.
 */
export function showWholeGenomeLabel(
  assembly: { chromosomes: readonly unknown[] } | undefined,
) {
  return assembly?.chromosomes.length
    ? 'Show all chromosomes'
    : 'Show all regions in assembly'
}
