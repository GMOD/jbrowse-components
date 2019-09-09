export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/BreakpointSplitView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/BreakpointSplitView'),
  )

  class BreakpointSplitViewType extends ViewType {
    snapshotFromBreakendFeature(feature, startRegion, endRegion) {
      const breakendSpecification = (feature.get('ALT') || [])[0]
      const matePosition = breakendSpecification.MatePosition.split(':')
      matePosition[1] = parseInt(matePosition[1], 10) - 1 // convert to interbase coord
      const [endRef, endPos] = matePosition
      const startRef = feature.get('refName')
      const startPos = feature.get('start')

      const bpPerPx = 0.2

      const topRegions = [{ ...startRegion }, { ...startRegion }]
      if (breakendSpecification.Join === 'left') {
        topRegions[0].end = startPos - 1
        topRegions[1].start = startPos - 1
      } else {
        topRegions[0].end = startPos
        topRegions[1].start = startPos
      }
      const bottomRegions = [{ ...endRegion }, { ...endRegion }]
      if (breakendSpecification.MateDirection === 'left') {
        bottomRegions[0].end = endPos - 1
        bottomRegions[1].start = endPos - 1
      } else {
        bottomRegions[0].end = endPos
        bottomRegions[1].start = endPos
      }

      const snapshot = {
        type: 'BreakpointSplitView',
        topLGV: {
          type: 'LinearGenomeView',
          displayedRegions: topRegions,
          hideHeader: true,
          bpPerPx,
          offsetPx: (topRegions[0].end - topRegions[0].start) / bpPerPx - 100,
        },
        bottomLGV: {
          type: 'LinearGenomeView',
          displayedRegions: bottomRegions,
          hideHeader: true,
          bpPerPx,
          offsetPx:
            (bottomRegions[0].end - bottomRegions[0].start) / bpPerPx - 100,
        },
        displayName: `${feature.get('name') ||
          feature.get('id') ||
          'breakend'} detail`,
      }
      return snapshot
    }
  }

  return new BreakpointSplitViewType({
    name: 'BreakpointSplitView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}
