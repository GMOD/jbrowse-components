import { getConf } from '@jbrowse/core/configuration'
import {
  getEnv,
  isSessionModelWithWidgets,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'

import { assemblyToUcscDb } from './ucscDbMap.ts'

import type {
  AbstractViewContainer,
  AbstractViewModel,
  AssemblyHost,
  DialogHost,
  NotificationSink,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

/**
 * What this plugin asks of the host it is installed into: an assembly to
 * resolve a UCSC db against, views to navigate, somewhere to report a hit it
 * could not reach, and somewhere to put its two dialogs. Everything else it
 * needs — adding the result track, opening the results panel — it asks for with
 * a guard, because a host may not offer it.
 */
export interface UcscHost
  extends AbstractViewContainer, AssemblyHost, NotificationSink, DialogHost {}

interface NavigableView extends AbstractViewModel {
  showTrack: (trackId: string) => void
  navToLocString: (
    locString: string,
    assemblyName?: string,
    grow?: number,
  ) => Promise<void>
}

function isNavigableView(view: AbstractViewModel): view is NavigableView {
  return (
    'showTrack' in view &&
    typeof view.showTrack === 'function' &&
    'navToLocString' in view &&
    typeof view.navToLocString === 'function'
  )
}

// jb2hubs stamps the UCSC db on the assembly's sequence.metadata. Its presence
// is also the one positive proof that UCSC can search the assembly, so the
// dialogs read it directly to decide whether to warn.
export function ucscDbStamp(session: UcscHost, name: string) {
  const assembly = session.assemblyManager.get(name)
  const stamped: string | undefined = assembly
    ? getConf(assembly, ['sequence', 'metadata', 'blatDb'])
    : undefined
  return stamped
}

// Prefers the stamp, falling back to the static alias map for assemblies whose
// configs predate it. Shared by the BLAT and in-silico PCR dialogs.
export function resolveUcscDb(session: UcscHost, name: string) {
  const stamped = ucscDbStamp(session, name)
  return stamped ? stamped : assemblyToUcscDb(name)
}

/**
 * Whether this host can draw a hit as an alignment rather than as plain blocks.
 *
 * Results are added as an AlignmentsTrack over a SamAdapter, which is what draws
 * the blocks, the indels, the soft-clipped query ends and the per-base
 * mismatches. SamAdapter arrived in JBrowse after v4.3.0, and an external plugin
 * is loaded by whatever host a config points it at — including releases older
 * than the plugin itself. Asking the host is the difference between quietly
 * falling back to the block-structure track BLAT results always used to be, and
 * adding a track whose adapter cannot resolve.
 */
export function canRenderAlignments(session: UcscHost) {
  const { pluginManager } = getEnv(session)
  return (
    pluginManager.adapterTypes.has('SamAdapter') &&
    pluginManager.trackTypes.has('AlignmentsTrack')
  )
}

// Builds a locstring from a feature. Feature coordinates are interbase, so the
// start needs +1 to become the 1-based coordinate a locstring names.
export function featureLocString(feature: SimpleFeatureSerialized) {
  return `${feature.refName}:${feature.start + 1}-${feature.end}`
}

function findNavigableView(session: UcscHost, assembly: string) {
  const view = session.views.find(
    v => v.type === 'LinearGenomeView' && !!v.assemblyNames?.includes(assembly),
  )
  return view && isNavigableView(view) ? view : undefined
}

// Navigates an open view to a hit, growing the window so it lands with flanking
// context rather than filling the viewport edge to edge. Shared by the
// post-query navigation and the results widget's per-hit links.
export async function navToFeature(
  session: UcscHost,
  assembly: string,
  feature: SimpleFeatureSerialized,
) {
  const view = findNavigableView(session, assembly)
  const loc = featureLocString(feature)
  if (view) {
    try {
      await view.navToLocString(loc, assembly, 0.2)
    } catch (e) {
      // a hit on a refName the loaded assembly doesn't know (the UCSC db and
      // the loaded assembly aren't the same build, or lack an alias) still
      // belongs in the track — report the coordinates rather than dropping them
      session.notify(`Could not navigate to ${loc}: ${e}`, 'warning')
    }
  } else {
    session.notify(`No open view displays ${assembly}`, 'warning')
  }
}

// How a result set is displayed. Defaults to an on-the-fly FromConfigAdapter
// FeatureTrack, which is all an hgPcr product needs; a BLAT hit overrides it
// with a SAM alignment so its blocks, indels and per-base mismatches are drawn.
// `displayDefaults` is the shorthand for slots on that track's default display.
export interface ResultTrackConf {
  type: string
  adapter: Record<string, unknown>
  displayDefaults?: Record<string, unknown>
}

// Turns a UCSC query result into an on-the-fly track, shows it, and opens the
// result list in the drawer. Deliberately does NOT navigate: "first" is the
// server's ordering, not the user's intent, so jumping there picks a result for
// them — an off-target product can take the view — and it throws away wherever
// they were when they asked. The drawer lists every result as a link, so going to
// one is a click, and which one is theirs to choose. Callers pass `features`
// best-first (pslToFeatures sorts by score; hgPcr returns its products in order).
export async function addResultTrack({
  session,
  assembly,
  features,
  trackIdPrefix,
  trackName,
  trackConf,
  resultNoun,
}: {
  session: UcscHost
  assembly: string
  features: SimpleFeatureSerialized[]
  trackIdPrefix: string
  trackName: string
  trackConf?: ResultTrackConf
  // what the results panel calls one of these; hgPcr's are products, not hits
  resultNoun?: 'hit' | 'product'
}) {
  if (!isSessionWithAddSessionTrack(session)) {
    throw new Error("Can't add tracks to this session")
  }
  const trackId = `${trackIdPrefix}-${Date.now()}`
  const resultTrack = trackConf ?? {
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features },
  }
  session.addSessionTrackConf({
    ...resultTrack,
    trackId,
    name: trackName,
    assemblyNames: [assembly],
  })
  const view = findNavigableView(session, assembly)
  if (view) {
    view.showTrack(trackId)
  } else {
    session.notify(
      `Added track "${trackId}" but no open view displays ${assembly}`,
      'warning',
    )
  }
  // #region showWidget
  // addWidget constructs the widget and returns it; showWidget is what puts it
  // in the drawer. The third argument is the initial state, so its keys are the
  // properties UcscResultsWidget's state model declares. Not every session has
  // a drawer — an embedded component may be built without one — so the guard is
  // not optional.
  if (isSessionModelWithWidgets(session)) {
    session.showWidget(
      session.addWidget('UcscResultsWidget', 'ucscResults', {
        features,
        assembly,
        trackName,
        resultNoun,
      }),
    )
  }
  // #endregion
}
