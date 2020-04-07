import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/BreakpointSplitView'))
  const { stateModel } = jbrequire(require('./model'))

  class BreakpointSplitViewType extends ViewType {
    async snapshotFromBreakendFeature(
      feature: Feature,
      view: {
        displayedRegions: [{ start: number; end: number; refName: string }]
      },
    ) {
      const breakendSpecification = (feature.get('ALT') || [])[0]
      const startPos = feature.get('start')
      let endPos
      const bpPerPx = 10

      const getCanonicalRefName = (ref: string) => {
        return ref
      }
      const featureRefName = await getCanonicalRefName(feature.get('refName'))

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
          mateRefName = await getCanonicalRefName(INFO.CHR2[0])
        } else {
          const matePosition = breakendSpecification.MatePosition.split(':')
          endPos = parseInt(matePosition[1], 10) - 1
          mateRefName = await getCanonicalRefName(matePosition[0])
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
        mateRefName = await getCanonicalRefName(mate.refName)
        endPos = mate.start
      }

      if (!mateRefName) {
        console.warn(
          `unable to resolve mate refName ${mateRefName} in reference genome`,
        )
        return {}
      }

      const bottomRegion = view.displayedRegions.find(
        f => f.refName === String(mateRefName),
      )

      if (!topRegion || !bottomRegion) {
        console.warn(
          `unable to find the refName for the top or bottom of the breakpoint view`,
        )
        return {}
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
            hideCloseButton: true,
            hideHeader: true,
            bpPerPx,
            offsetPx: (topRegion.start + feature.get('start')) / bpPerPx,
          },
          {
            type: 'LinearGenomeView',
            displayedRegions: bottomMarkedRegion,
            hideHeader: true,
            hideCloseButton: true,
            bpPerPx,
            offsetPx: (bottomRegion.start + endPos) / bpPerPx,
          },
        ],
        displayName: `${feature.get('name') ||
          feature.get('id') ||
          'breakend'} split detail`,
      }
      return snapshot
    }
  }

  // @ts-ignore
  return new BreakpointSplitViewType({
    name: 'BreakpointSplitView',
    stateModel,
    ReactComponent,
  })
}
