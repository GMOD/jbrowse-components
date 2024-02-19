import { getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getBreakpointSplitView({
  f1,
  f2,
  view,
}: {
  f1: { start: number; end: number; refName: string }
  f2: { start: number; end: number; refName: string }
  view: LinearGenomeViewModel
}) {
  const { assemblyName } = view.displayedRegions[0]
  const { assemblyManager } = getSession(view)
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }
  const topRegion = assembly.regions.find(f => f.refName === f1.refName)
  const bottomRegion = assembly.regions.find(f => f.refName === f2.refName)

  if (!topRegion || !bottomRegion) {
    throw new Error(
      `unable to find the refName for the top or bottom of the breakpoint view`,
    )
  }
  const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
  const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]

  topMarkedRegion[0].end = f1.start
  topMarkedRegion[1].start = f1.start + 1
  bottomMarkedRegion[0].end = f2.start
  bottomMarkedRegion[1].start = f2.start + 1
  const bpPerPx = 10
  return {
    type: 'BreakpointSplitView',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: topMarkedRegion,
        hideHeader: true,
        bpPerPx,
        offsetPx: (topRegion.start + f1.start) / bpPerPx,
        tracks: [] as { trackId: string }[],
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: bottomMarkedRegion,
        hideHeader: true,
        bpPerPx,
        offsetPx: (bottomRegion.start + f2.start) / bpPerPx,
        tracks: [] as { trackId: string }[],
      },
    ],
    displayName: `breakend split detail`,
  }
}
