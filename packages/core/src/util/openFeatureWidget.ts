import {
  getContainingTrack,
  getContainingView,
  getSession,
} from './index.ts'
import SimpleFeature from './simpleFeature.ts'
import { isSessionModelWithWidgets } from './types/index.ts'

import type { SimpleFeatureSerialized } from './simpleFeature.ts'
import type { Widget } from './types/index.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FeatureWidgetTypeRef {
  type: string
  id: string
}

const DEFAULT_FEATURE_WIDGET: FeatureWidgetTypeRef = {
  type: 'BaseFeatureWidget',
  id: 'baseFeature',
}

// Open a feature widget for the given featureData and mark it as the
// session's selected feature. Node is any MST node in the display tree —
// used to resolve session + containing view + containing track. Returns
// the new widget, or undefined if the session can't host widgets (e.g.
// headless export contexts).
//
// This consolidates the addWidget/showWidget/setSelection/getContainingView/
// getContainingTrack/isSessionModelWithWidgets boilerplate that every
// "click a feature → open details" flow had to repeat. setSelection is
// always called so cross-view selection-sync features work uniformly —
// callers previously split on this, which was likely accidental (the
// non-BaseLinearDisplay-composers had hand-rolled selectFeature actions
// and just omitted it).
export function openFeatureWidget(
  node: IAnyStateTreeNode,
  featureData: SimpleFeatureSerialized,
  opts: {
    // Override the widget type (e.g. `AlignmentsFeatureWidget`).
    widget?: FeatureWidgetTypeRef
    // Extra initialState fields merged into the widget. Use for adapter
    // metadata, descriptions, etc.
    extra?: Record<string, unknown>
  } = {},
): Widget | undefined {
  const session = getSession(node)
  if (!isSessionModelWithWidgets(session)) {
    return undefined
  }
  session.setSelection(new SimpleFeature(featureData))
  const { type, id } = opts.widget ?? DEFAULT_FEATURE_WIDGET
  const widget = session.addWidget(type, id, {
    featureData,
    view: getContainingView(node),
    track: getContainingTrack(node),
    ...opts.extra,
  })
  session.showWidget(widget)
  return widget
}
