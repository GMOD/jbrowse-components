import { parseBreakend } from '@gmod/vcf'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import {
  type AbstractSessionModel,
  type Feature,
  gatherOverlaps,
} from '@jbrowse/core/util'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

function getMateInfo(feature: Feature, alt: string | undefined) {
  const bnd = alt ? parseBreakend(alt) : undefined

  if (alt === '<TRA>') {
    const info = feature.get('INFO')
    return { mateRefName: info.CHR2[0], matePos: info.END[0] - 1 }
  }

  if (bnd?.MatePosition) {
    const [ref, pos] = bnd.MatePosition.split(':')
    return { mateRefName: ref!, matePos: +pos! - 1 }
  }

  const mate = feature.get('mate')
  if (mate) {
    return { mateRefName: mate.refName, matePos: mate.start }
  }

  return { mateRefName: feature.get('refName'), matePos: feature.get('end') }
}

export default class BreakpointSplitViewType extends ViewType {
  getBreakendCoveringRegions({
    feature,
    assembly,
  }: {
    feature: Feature
    assembly: Assembly
  }) {
    const canonicalize = (ref: string) =>
      assembly.getCanonicalRefName(ref) || ref
    const alt = feature.get('ALT')?.[0]
    const refName = feature.get('refName')
    const { mateRefName, matePos } = getMateInfo(feature, alt)

    return {
      pos: feature.get('start'),
      refName: canonicalize(refName),
      mateRefName: canonicalize(mateRefName),
      matePos,
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
    const coverage = this.getBreakendCoveringRegions({ feature, assembly })
    const { refName, mateRefName } = coverage
    const topRegion = assembly.regions.find(r => r.refName === refName)
    const bottomRegion = assembly.regions.find(r => r.refName === mateRefName)
    if (!topRegion || !bottomRegion) {
      throw new Error(`could not find regions for ${refName} or ${mateRefName}`)
    }
    const featureName = feature.get('name') || feature.get('id') || 'breakend'
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
        displayName: `${featureName} split detail`,
      },
    }
  }
}
