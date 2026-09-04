// straight from mstUtils rather than the barrel, which re-exports this module:
// a value import of './index.ts' from a module the barrel re-exports is the
// cycle shape that bites under Rollup (TDZ) and babel/CJS (getter before
// require) alike
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from './mstUtils.ts'
import { getNotificationSink } from './sessionServices.ts'
import SimpleFeature from './simpleFeature.ts'
import { isSessionModelWithWidgets } from './types/index.ts'

import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'
import type { Widget } from './types/index.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FeatureWidgetTypeRef {
  type: string
  id: string
}

// The feature a details panel was reached THROUGH, when it was reached through
// one: a transcript clicked inside its gene, whose name is then the one thing
// the panel cannot show. A summary and never the parent's own record -- a
// RefSeq gene carries every sibling isoform and all their exons, and this is
// persisted in the session snapshot.
export interface ParentFeatureSummary {
  name: string
  type?: string
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
    // The live Feature `featureData` was serialized from, when the caller
    // still holds it. Only an optimization -- `setSelection` is given this
    // instead of a rebuilt one, and the two are interchangeable because
    // `featureData` is this feature's own `toJSON()` (which already bakes in
    // the parentId and inherited strand that a reconstructed feature would
    // otherwise lack).
    //
    // Worth threading because `new SimpleFeature` is not shallow: its
    // constructor inflates the whole subfeature tree, so rebuilding one for a
    // gene the user just clicked allocates a wrapper per exon and per CDS of
    // every transcript -- ~16k of them for a RefSeq BRCA1 -- purely to hand
    // the session a feature it was already given.
    feature?: Feature
    // The feature this one was reached THROUGH, when it was reached through
    // one -- a transcript clicked inside its gene. **Named as the display DREW
    // it**: which of an annotation's fields names a feature on screen is the
    // track's own `labels.name` expression, so the display is the only side
    // that can answer, and a panel that answered it differently would disagree
    // with the label and the hover for the same gene. Nothing is derived here
    // from the feature's parent handle for that reason.
    parentFeature?: ParentFeatureSummary
  } = {},
): Widget | undefined {
  const session = getSession(node)
  if (!isSessionModelWithWidgets(session)) {
    return undefined
  }
  session.setSelection(opts.feature ?? new SimpleFeature(featureData))
  const { type, id } = opts.widget ?? DEFAULT_FEATURE_WIDGET
  const widget = session.addWidget(type, id, {
    featureData,
    parentFeature: opts.parentFeature,
    view: getContainingView(node),
    track: getContainingTrack(node),
    ...opts.extra,
  })
  session.showWidget(widget)
  return widget
}

/**
 * The other half of the flow above: the details lookup came back with nothing,
 * so there is no widget to open.
 *
 * Every display paints from slim render arrays and re-fetches the whole feature
 * on click, so a lookup can come back empty for reasons the user cannot see —
 * the data was evicted under them, or the id does not compare in the tier that
 * answered. **Silently doing nothing is the worst response to a click**, and it
 * was what three canvas paths did.
 *
 * Here rather than per plugin because the sentence is one fact and the two
 * families would otherwise word it differently for the same event. It is
 * deliberately NOT what an *error* says: a throw already reaches `notifyError`
 * with the reason, and a display that notifies both tells the user off twice for
 * one click.
 *
 * A **speculative** lookup must not call this — alignments pre-warms the read
 * behind a context menu, and the user asked for nothing there, so the menu just
 * doesn't grow its feature items.
 */
export function notifyFeatureDetailsMiss(node: IAnyStateTreeNode) {
  getNotificationSink(node).notify(
    'Could not load details for this feature',
    'warning',
  )
}
