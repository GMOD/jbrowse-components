import type { Assembly } from '../assemblyManager/assembly.ts'
import type { Region } from './types/data.ts'

/**
 * Clamp a span to the extents of the contig it names, resolving the refName to
 * canonical on the way. Returns undefined when the clamp leaves nothing — the
 * span lies wholly off the end of the contig.
 *
 * **The undefined is the point.** A one-sided clamp is the shape this keeps
 * getting written as, and it inverts: a span past the contig end comes back with
 * its end below its start, which every consumer that SUMS region lengths then
 * subtracts. That is silent, and it happens for real, on a GFF3 or a BAM
 * annotated against a longer assembly than the FASTA in use — which JBrowse
 * otherwise just draws past the end of. Two callers wrote the one-sided version
 * and only one of them ever guarded it.
 *
 * `start` is floored at 0 even when the contig extents are unknown (`regions`
 * still loading, or a refName this assembly doesn't have), because interbase has
 * no coordinate below 0 whatever the contig turns out to be. Only the high end
 * needs a length to clamp against, so without one it is left alone — and with no
 * high bound there is nothing to invert, so such a span always comes back.
 */
export function clampToContig(
  assembly: Assembly,
  region: { refName: string; start: number; end: number },
): Region | undefined {
  const refName = assembly.getCanonicalRefName2(region.refName)
  const bounds = assembly.getRegionForRefName(refName)
  const start = Math.max(bounds?.start ?? 0, region.start)
  const end = bounds ? Math.min(bounds.end, region.end) : region.end
  return end > start
    ? { ...region, assemblyName: assembly.name, refName, start, end }
    : undefined
}
