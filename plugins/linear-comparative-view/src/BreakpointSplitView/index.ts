import { Feature } from '@jbrowse/core/util/simpleFeature'
import PluginManager from '@jbrowse/core/PluginManager'

import { IAnyStateTreeNode } from 'mobx-state-tree'
import modelF from './model'
import componentF from '../LinearComparativeView/components/LinearComparativeView'

export default ({ lib, load }: PluginManager) => {
  const ViewType = lib['@jbrowse/core/pluggableElementTypes/ViewType']
  const { getSession } = lib['@jbrowse/core/util']

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ReactComponent = load(componentF) as any
  const stateModel = load(modelF)

  class BreakpointSplitViewType extends ViewType {
    snapshotFromBreakendFeature(
      feature: Feature,
      view: IAnyStateTreeNode & {
        displayedRegions: [
          { assemblyName: string; start: number; end: number; refName: string },
        ]
      },
    ) {
      const breakendSpecification = (feature.get('ALT') || [])[0]
      const startPos = feature.get('start')
      let endPos
      const bpPerPx = 10

      // TODO: Figure this out for multiple assembly names
      const { assemblyName } = view.displayedRegions[0]
      const assembly = getSession(view).assemblyManager.get(assemblyName)
      if (!assembly) throw new Error('assembly not yet loaded')
      const { getCanonicalRefName } = assembly
      const featureRefName = getCanonicalRefName(feature.get('refName'))

      const topRegion = view.displayedRegions.find(
        (f: { refName: string }) => f.refName === String(featureRefName),
      )

      let mateRefName: string | undefined
      let startMod = 0
      let endMod = 0

      if (breakendSpecification) {
        // a VCF breakend feature
        if (breakendSpecification === '<TRA>') {
          const INFO = feature.get('INFO') || []
          endPos = INFO.END[0] - 1
          mateRefName = getCanonicalRefName(INFO.CHR2[0])
        } else if (breakendSpecification.MatePosition) {
          const matePosition = breakendSpecification.MatePosition.split(':')
          endPos = parseInt(matePosition[1], 10) - 1
          mateRefName = getCanonicalRefName(matePosition[0])
          if (breakendSpecification.Join === 'left') startMod = -1
          if (breakendSpecification.MateDirection === 'left') endMod = -1
        }

        // if (breakendSpecification.Join === 'left') {
        // marker -1, else 0

        // if (breakendSpecification.MateDirection === 'left') {
        // marker -1, else 0
      } else if (feature.get('mate')) {
        // a generic 'mate' feature
        const mate = feature.get('mate')
        mateRefName = getCanonicalRefName(mate.refName)
        endPos = mate.start
      }

      if (!mateRefName) {
        console.warn(
          `unable to resolve mate refName ${mateRefName} in reference genome`,
        )
        return undefined
      }

      const bottomRegion = view.displayedRegions.find(
        f => f.refName === String(mateRefName),
      )

      if (!topRegion || !bottomRegion) {
        console.warn(
          `unable to find the refName for the top or bottom of the breakpoint view`,
        )
        return undefined
      }

      const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
      const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]
      topMarkedRegion[0].end = startPos + startMod
      topMarkedRegion[1].start = startPos + startMod
      bottomMarkedRegion[0].end = endPos + endMod
      bottomMarkedRegion[1].start = endPos + endMod
      const snapshot = {
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
      return snapshot
    }
  }

  return new BreakpointSplitViewType({
    name: 'BreakpointSplitView',
    stateModel,
    ReactComponent,
  })
}
