import type { LoadedRegionSpan } from '@jbrowse/tree-sidebar'

export function loadedRegionIndexOverlapping(
  loadedRegions: { entries: () => Iterable<[number, LoadedRegionSpan]> },
  refName: string,
  start: number,
  end: number,
) {
  const overlapping = [...loadedRegions.entries()].filter(
    ([, region]) =>
      region.refName === refName && start < region.end && end > region.start,
  )
  return overlapping.length > 0
    ? Math.min(...overlapping.map(([index]) => index))
    : undefined
}
