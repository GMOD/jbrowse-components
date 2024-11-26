import { parseBreakend } from '@gmod/vcf'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import {
  type AbstractSessionModel,
  type Feature,
  gatherOverlaps,
} from '@jbrowse/core/util'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

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

  singleLevelSnapshotFromBreakendFeature({
    feature,
    session,
    assemblyName,
  }: {
    feature: Feature
    session: AbstractSessionModel
    assemblyName: string
  }) {
    const { assemblyManager } = session
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`assembly ${assemblyName} not found`)
    }
    if (!assembly.regions) {
      throw new Error(`assembly ${assemblyName} regions not loaded`)
    }
    const coverage = this.getBreakendCoveringRegions({
      feature,
      assembly,
    })
    const { refName, mateRefName } = coverage
    const topRegion = assembly.regions.find(f => f.refName === refName)!
    const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)!
    return {
      coverage,
      snap: {
        type: 'BreakpointSplitView',
        views: [
          {
            type: 'LinearGenomeView',
            displayedRegions: gatherOverlaps([topRegion, bottomRegion]),
          },
        ],
        displayName: `${
          feature.get('name') || feature.get('id') || 'breakend'
        } split detail`,
      },
    }
  }
}
