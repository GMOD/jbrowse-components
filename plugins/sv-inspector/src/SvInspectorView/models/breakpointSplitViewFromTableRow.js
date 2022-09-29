import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { makeAdHocSvFeature } from './adhocFeatureUtils'
import { getEnv, getSession } from '@jbrowse/core/util'

export function getSerializedFeatureForRow(
  session,
  spreadsheetView,
  row,
  rowNumber,
) {
  if (row.extendedData) {
    if (row.extendedData.vcfFeature) {
      return row.extendedData.vcfFeature
    }
    if (row.extendedData.feature) {
      return row.extendedData.feature
    }
  }
  const adhocFeature = makeAdHocSvFeature(
    spreadsheetView.spreadsheet,
    rowNumber,
    row,
    session.assemblyManager.isValidRefName,
  )
  if (adhocFeature) {
    return adhocFeature
  }
  return undefined
}

export function breakpointSplitViewSnapshotFromTableRow(
  svInspectorView,
  spreadsheetView,
  spreadsheet,
  row,
  rowNumber,
) {
  const { pluginManager } = getEnv(svInspectorView)
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

export function openBreakpointSplitViewFromTableRow(
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

export function canOpenBreakpointSplitViewFromTableRow(
  svInspectorView,
  spreadsheetView,
  spreadsheet,
  row,
  rowNumber,
) {
  try {
    const viewSnapshot = breakpointSplitViewSnapshotFromTableRow(
      svInspectorView,
      spreadsheetView,
      spreadsheet,
      row,
      rowNumber,
    )
    return Boolean(viewSnapshot)
  } catch (e) {
    console.error('Unable to open breakpoint split view from table row', e)
    return false
  }
}
