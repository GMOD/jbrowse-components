/**
 * @module
 * One walk of "every display on an open track, across all open views".
 *
 * Lives here rather than in `configuration/promotableDefaults.ts`, where it grew:
 * nothing about it is a cascade concern — it answers "the tracks the user is
 * looking at", and its two callers want that for different reasons (the promoted
 * default's "apply to open tracks", and `product-core`'s share/export bake). It
 * cannot move next to either one: `product-core` imports `@jbrowse/core`, never
 * the reverse.
 *
 * The displays are typed `ResolvableDisplay` because both callers immediately
 * resolve config off them, and that shape (`IStateTreeNode` + `type` +
 * `configuration`) is the smallest thing either needs.
 */
import { isObject } from './objectUtils.ts'
import { isViewContainer } from './types/index.ts'

import type { ResolvableDisplay } from '../configuration/promotableResolve.ts'
import type { AbstractSessionModel } from './types/index.ts'

// A view whose open tracks we can enumerate. The generic view interface doesn't
// surface `tracks`, so narrow structurally — the declared display shape is the
// same ResolvableDisplay the cascade already operates on.
//
// Checks the elements, not just that `tracks` is an array: this narrowing is
// what every consumer downstream trusts, and an element without `displays`
// would put `undefined` in the walk and throw at the first `display.type` —
// inside a share/export bake, i.e. as far from the cause as it gets. Every
// `tracks`-bearing view today holds real track models, so this only ever
// confirms what is already true.
function hasOpenTracks<T extends object>(
  view: T,
): view is T & { tracks: { displays: ResolvableDisplay[] }[] } {
  return (
    'tracks' in view &&
    Array.isArray(view.tracks) &&
    view.tracks.every(t => isObject(t) && Array.isArray(t.displays))
  )
}

// A composite view holding child views in a `views` array: breakpoint-split and
// the linear-comparative family incl. synteny. Not exclusive with
// `hasOpenTracks`: LinearComparativeView has both its own synteny tracks and two
// child LGVs.
//
// A view that holds its children under *named* props instead (SvInspectorView's
// `spreadsheetView`/`circularView`) is NOT reached. Enumerating a view's own
// properties to find them isn't an option — reading every key of an MST node
// invokes every computed view on it, several of which throw before the view is
// initialized. No display reachable that way declares a promotable slot today,
// so nothing is currently missed; if one ever does, give that view a `views`
// getter returning its children rather than duck-typing harder here.
function hasChildViews<T extends object>(
  view: T,
): view is T & { views: object[] } {
  return (
    'views' in view &&
    Array.isArray(view.views) &&
    view.views.every(v => typeof v === 'object' && v !== null)
  )
}

function displaysInView(view: object): ResolvableDisplay[] {
  return [
    ...(hasOpenTracks(view) ? view.tracks.flatMap(t => t.displays) : []),
    ...(hasChildViews(view) ? view.views.flatMap(displaysInView) : []),
  ]
}

/**
 * #api core/util
 * Every display on an open track, across all open views — the reach of anything
 * that acts on "the tracks the user is looking at": a promoted default's "apply
 * to open tracks", and the share/export bake. One walk so those can't drift
 * apart.
 *
 * Recurses into composite views. A display nested in one resolves the cascade
 * like any other but was invisible to both callers, so the share/export bake
 * didn't bake its inherited values and a shared session containing a
 * breakpoint-split or synteny view rendered differently for the recipient.
 * `LGVSyntenyDisplay` is only ever reached through this branch, so don't flatten
 * the recursion away. `hasChildViews` names the one composite shape it does not
 * cover.
 *
 * A view holding neither (e.g. spreadsheet) drops out via the structural guards.
 * A view whose displays declare no promotable slot (e.g. dotplot, which does
 * hold tracks) is walked and contributes nothing — harmless, and cheaper than
 * asking each display whether it has anything to promote.
 */
export function openPromotableDisplays(
  session: AbstractSessionModel,
): ResolvableDisplay[] {
  const views = isViewContainer(session) ? session.views : []
  return views.flatMap(displaysInView)
}
