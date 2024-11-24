// @ts-nocheck
import { SimpleFeature, getEnv, getSession } from '@jbrowse/core/util'

export function breakpointSplitViewSnapshotFromTableRow(
  svInspectorView,
  spreadsheetView,
  spreadsheet,
  row,
) {
  const { pluginManager } = getEnv(svInspectorView)
  const session = getSession(spreadsheetView)
  const featureData = row.feature

  if (featureData) {
    const feature = new SimpleFeature(featureData)
    session.setSelection(feature)
    return pluginManager
      .getViewType('BreakpointSplitView')
      .snapshotFromBreakendFeature(feature, svInspectorView.circularView)
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
    return Boolean(
      breakpointSplitViewSnapshotFromTableRow(
        svInspectorView,
        spreadsheetView,
        spreadsheet,
        row,
        rowNumber,
      ),
    )
  } catch (e) {
    console.error('Unable to open breakpoint split view from table row', e)
    return false
  }
}
