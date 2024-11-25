import { parseBreakend } from '@gmod/vcf'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getSession } from '@jbrowse/core/util'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from 'mobx-state-tree'

export default class BreakpointSplitViewType extends ViewType {
  getBreakendCoveringRegions({
    feature,
    assembly,
  }: {
    feature: Feature
    assembly: Assembly
  }) {
    const alt = feature.get('ALT')?.[0]
    const bnd = alt ? parseBreakend(alt) : undefined
    const startPos = feature.get('start')
    const refName = feature.get('refName')
    let endPos: number

    let mateRefName: string | undefined

    // a VCF breakend feature
    if (alt === '<TRA>') {
      const INFO = feature.get('INFO')
      endPos = INFO.END[0] - 1
      mateRefName = INFO.CHR2[0]
    } else if (bnd?.MatePosition) {
      const matePosition = bnd.MatePosition.split(':')
      endPos = +matePosition[1]! - 1
      mateRefName = matePosition[0]!
    } else if (feature.get('mate')) {
      // a generic 'mate' feature
      const mate = feature.get('mate')
      mateRefName = mate.refName
      endPos = mate.start
    } else {
      endPos = startPos + 1
    }

    if (!mateRefName) {
      throw new Error(
        `unable to resolve mate refName ${mateRefName} in reference genome`,
      )
    }

    return {
      pos: startPos,
      refName: assembly.getCanonicalRefName(refName),
      mateRefName: assembly.getCanonicalRefName(mateRefName),
      matePos: endPos,
    }
  }

  singleLevelSnapshotFromBreakendFeature(
    feature: Feature,
    view: { displayedRegions: Region[] } & IStateTreeNode,
  ) {
    const session = getSession(view)
    const bpPerPx = 10
    const { assemblyName } = view.displayedRegions[0]!

    const { assemblyManager } = session
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`assembly ${assemblyName} not found`)
    }
    if (!assembly.regions) {
      throw new Error(`assembly ${assemblyName} regions not loaded`)
    }
    const {
      refName,
      pos: startPos,
      mateRefName,
      matePos: endPos,
    } = this.getBreakendCoveringRegions({
      feature,
      assembly,
    })

    const topRegion = assembly.regions.find(f => f.refName === refName)!
    const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)!
    const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
    const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]
    topMarkedRegion[0]!.end = startPos
    topMarkedRegion[1]!.start = startPos
    bottomMarkedRegion[0]!.end = endPos
    bottomMarkedRegion[1]!.start = endPos
    return {
      type: 'BreakpointSplitView',
      views: [
        {
          type: 'LinearGenomeView',
          displayedRegions: topMarkedRegion,
          hideHeader: true,
          bpPerPx,
          offsetPx: (topRegion.start + feature.get('start')) / bpPerPx,
        },
      ],
      displayName: `${
        feature.get('name') || feature.get('id') || 'breakend'
      } split detail`,
      featureData: undefined as unknown,
    }
  }

  snapshotFromBreakendFeature(
    feature: Feature,
    view: { displayedRegions: Region[] } & IStateTreeNode,
  ) {
    const session = getSession(view)
    const bpPerPx = 10
    const { assemblyName } = view.displayedRegions[0]!

    const { assemblyManager } = session
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`assembly ${assemblyName} not found`)
    }
    if (!assembly.regions) {
      throw new Error(`assembly ${assemblyName} regions not loaded`)
    }
    const {
      refName,
      pos: startPos,
      mateRefName,
      matePos: endPos,
    } = this.getBreakendCoveringRegions({
      feature,
      assembly,
    })

    const topRegion = assembly.regions.find(f => f.refName === refName)!
    const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)!
    const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
    const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]
    topMarkedRegion[0]!.end = startPos
    topMarkedRegion[1]!.start = startPos
    bottomMarkedRegion[0]!.end = endPos
    bottomMarkedRegion[1]!.start = endPos
    return {
      type: 'BreakpointSplitView',
      views: [
        {
          type: 'LinearGenomeView',
          displayedRegions: topMarkedRegion,
          hideHeader: true,
          bpPerPx,
          offsetPx: (topRegion.start + feature.get('start')) / bpPerPx,
        },
        {
          type: 'LinearGenomeView',
          displayedRegions: bottomMarkedRegion,
          hideHeader: true,
          bpPerPx,
          offsetPx: (bottomRegion.start + endPos) / bpPerPx,
        },
      ],
      displayName: `${
        feature.get('name') || feature.get('id') || 'breakend'
      } split detail`,
    }
  }
}
