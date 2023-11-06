import { Feature, AbstractSessionModel } from '@jbrowse/core/util'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { parseBreakend } from '@gmod/vcf'

export default class BreakpointSplitViewType extends ViewType {
  async snapshotFromBreakendFeature(
    feature: Feature,
    assemblyName: string,
    session: AbstractSessionModel,
  ) {
    const alt = feature.get('ALT')?.[0]
    const bnd = alt ? parseBreakend(alt) : undefined
    const startPos = feature.get('start')
    let endPos
    const bpPerPx = 10
    const { assemblyManager } = session
    const assembly = await assemblyManager.waitForAssembly(assemblyName)

    if (!assembly) {
      throw new Error(`assembly ${assemblyName} not found`)
    }
    if (!assembly.regions) {
      throw new Error(`assembly ${assemblyName} regions not loaded`)
    }
    const featureRefName = assembly.getCanonicalRefName(feature.get('refName'))
    const topRegion = assembly.regions.find(f => f.refName === featureRefName)

    let mateRefName: string | undefined
    let startMod = 0
    let endMod = 0

    // a VCF breakend feature
    if (alt === '<TRA>') {
      const INFO = feature.get('INFO')
      endPos = INFO.END[0] - 1
      mateRefName = assembly.getCanonicalRefName(INFO.CHR2[0])
    } else if (bnd?.MatePosition) {
      const matePosition = bnd.MatePosition.split(':')
      endPos = +matePosition[1] - 1
      mateRefName = assembly.getCanonicalRefName(matePosition[0])
      if (bnd.Join === 'left') {
        startMod = -1
      }
      if (bnd.MateDirection === 'left') {
        endMod = -1
      }
    } else if (feature.get('mate')) {
      // a generic 'mate' feature
      const mate = feature.get('mate')
      mateRefName = assembly.getCanonicalRefName(mate.refName)
      endPos = mate.start
    }

    if (!mateRefName) {
      throw new Error(
        `unable to resolve mate refName ${mateRefName} in reference genome`,
      )
    }

    const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)

    if (!topRegion || !bottomRegion) {
      throw new Error(
        `unable to find the refName for the top or bottom of the breakpoint view`,
      )
    }

    const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
    const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]
    topMarkedRegion[0].end = startPos + startMod
    topMarkedRegion[1].start = startPos + startMod
    bottomMarkedRegion[0].end = endPos + endMod
    bottomMarkedRegion[1].start = endPos + endMod
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
      featureData: undefined as unknown,
    }
  }
}
