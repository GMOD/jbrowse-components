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
    const f = (ref: string) => assembly.getCanonicalRefName(ref) || ref

    if (alt === '<TRA>') {
      const INFO = feature.get('INFO')
      return {
        pos: startPos,
        refName: f(refName),
        mateRefName: f(INFO.CHR2[0]),
        matePos: INFO.END[0] - 1,
      }
    } else if (bnd?.MatePosition) {
      const matePosition = bnd.MatePosition.split(':')
      return {
        pos: startPos,
        refName: f(refName),
        mateRefName: f(matePosition[0]!),
        matePos: +matePosition[1]! - 1,
      }
    } else if (feature.get('mate')) {
      const mate = feature.get('mate')
      return {
        pos: startPos,
        refName: f(refName),
        mateRefName: f(mate.refName),
        matePos: mate.start,
      }
    } else {
      return {
        pos: startPos,
        refName: f(refName),
        mateRefName: f(refName),
        matePos: feature.get('end'),
      }
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
          displayedRegions: [...topMarkedRegion, ...bottomMarkedRegion],
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
