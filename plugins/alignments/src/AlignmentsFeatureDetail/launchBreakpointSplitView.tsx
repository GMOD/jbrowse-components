import { getSession } from '@jbrowse/core/util'
import type { ReducedFeature } from './getSAFeatures'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals

export function getBreakpointSplitView({
  f1,
  f2,
  view,
}: {
  f1: ReducedFeature
  f2: ReducedFeature
  view: LinearGenomeViewModel
}) {
  const { assemblyName } = view.displayedRegions[0]!
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
      'unable to find the refName for the top or bottom of the breakpoint view',
    )
  }
  const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
  const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]

  const s = f1.strand === 1 ? f1.end : f1.start
  const e = f2.strand === 1 ? f2.start : f2.end

  topMarkedRegion[0]!.end = s
  topMarkedRegion[1]!.start = s + 1
  bottomMarkedRegion[0]!.end = e
  bottomMarkedRegion[1]!.start = e + 1
  const bpPerPx = 10
  return {
    type: 'BreakpointSplitView',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: topMarkedRegion,
        hideHeader: true,
        bpPerPx,
        offsetPx: (topRegion.start + s) / bpPerPx,
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: bottomMarkedRegion,
        hideHeader: true,
        bpPerPx,
        offsetPx: (bottomRegion.start + e) / bpPerPx,
      },
    ],
    displayName: 'breakend split detail',
  }
}
