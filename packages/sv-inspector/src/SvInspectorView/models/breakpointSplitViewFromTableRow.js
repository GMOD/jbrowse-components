import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')

  const { makeAdHocSvFeature } = jbrequire(require('./adhocFeatureUtils'))

  function getSerializedFeatureForRow(
    session,
    spreadsheetView,
    row,
    rowNumber,
  ) {
    if (row.extendedData) {
      if (row.extendedData.vcfFeature) return row.extendedData.vcfFeature
      if (row.extendedData.feature) return row.extendedData.feature
    }
    const adhocFeature = makeAdHocSvFeature(
      spreadsheetView.spreadsheet,
      rowNumber,
      row,
      session.assemblyManager.isValidRefName,
    )
    if (adhocFeature) return adhocFeature
    return undefined
  }

  function breakpointSplitViewSnapshotFromTableRow(
    svInspectorView,
    spreadsheetView,
    spreadsheet,
    row,
    rowNumber,
  ) {
    const session = getSession(spreadsheetView)
    const featureData = getSerializedFeatureForRow(
      session,
      spreadsheet,
      row,
      rowNumber,
    )
    if (featureData) {
      const feature = new SimpleFeature(featureData)
      session.setSelection(feature)
      const viewType = pluginManager.getViewType('BreakpointSplitView')
      const { circularView } = svInspectorView
      const viewSnapshot = viewType.snapshotFromBreakendFeature(
        feature,
        circularView,
      )
      return viewSnapshot
    }
    return undefined
  }

  function openBreakpointSplitViewFromTableRow(
    svInspectorView,
    spreadsheetView,
    spreadsheet,
    row,
    rowNumber,
  ) {
    const viewSnapshot = breakpointSplitViewSnapshotFromTableRow(
      svInspectorView,
      spreadsheetView,
      spreadsheet,
      row,
      rowNumber,
    )
    if (viewSnapshot) {
      // try to center the offsetPx
      const { circularView } = svInspectorView
      viewSnapshot.views[0].offsetPx -= circularView.width / 2 + 100
      viewSnapshot.views[1].offsetPx -= circularView.width / 2 + 100

      const session = getSession(spreadsheetView)
      session.addView('BreakpointSplitView', viewSnapshot)
    }
  }

  function canOpenBreakpointSplitViewFromTableRow(
    svInspectorView,
    spreadsheetView,
    spreadsheet,
    row,
    rowNumber,
  ) {
    const viewSnapshot = breakpointSplitViewSnapshotFromTableRow(
      svInspectorView,
      spreadsheetView,
      spreadsheet,
      row,
      rowNumber,
    )
    return Boolean(viewSnapshot)
  }

  return {
    getSerializedFeatureForRow,
    breakpointSplitViewSnapshotFromTableRow,
    canOpenBreakpointSplitViewFromTableRow,
    openBreakpointSplitViewFromTableRow,
  }
}
