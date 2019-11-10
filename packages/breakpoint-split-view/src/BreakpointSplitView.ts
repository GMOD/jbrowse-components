import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'

export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/BreakpointSplitView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/BreakpointSplitView'),
  )

  class BreakpointSplitViewType extends ViewType {
    snapshotFromBreakendFeature(
      feature: Feature,
      startRegion: IRegion,
      endRegion: IRegion,
    ) {
      const breakendSpecification = (feature.get('ALT') || [])[0]
      const startPos = feature.get('start')
      let endPos
      const bpPerPx = 10
      const topRegions = [{ ...startRegion }, { ...startRegion }]
      const bottomRegions = [{ ...endRegion }, { ...endRegion }]
      if (breakendSpecification) {
        // a VCF breakend feature
        if (breakendSpecification === '<TRA>') {
          const INFO = feature.get('INFO') || []
          endPos = INFO.END[0] - 1
        } else {
          const matePosition = breakendSpecification.MatePosition.split(':')
          endPos = parseInt(matePosition[1], 10) - 1
        }
        if (breakendSpecification.Join === 'left') {
          topRegions[0].end = startPos - 1
          topRegions[1].start = startPos - 1
        } else {
          topRegions[0].end = startPos
          topRegions[1].start = startPos
        }
        if (breakendSpecification.MateDirection === 'left') {
          bottomRegions[0].end = endPos - 1
          bottomRegions[1].start = endPos - 1
        } else {
          bottomRegions[0].end = endPos
          bottomRegions[1].start = endPos
        }
      } else if (feature.get('mate')) {
        // a generic 'mate' feature
        const mate = feature.get('mate')
        topRegions[0].end = startPos
        topRegions[1].start = startPos
        bottomRegions[0].end = mate.start
        bottomRegions[1].start = mate.start
      }

      const snapshot = {
        type: 'BreakpointSplitView',
        views: [
          {
            type: 'LinearGenomeView',
            displayedRegions: topRegions,
            hideCloseButton: true,
            hideHeader: true,
            bpPerPx,
            offsetPx: (topRegions[0].end - topRegions[0].start) / bpPerPx,
          },
          {
            type: 'LinearGenomeView',
            displayedRegions: bottomRegions,
            hideHeader: true,
            hideCloseButton: true,
            bpPerPx,
            offsetPx: (bottomRegions[0].end - bottomRegions[0].start) / bpPerPx,
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
    configSchema,
    ReactComponent,
  })
}
