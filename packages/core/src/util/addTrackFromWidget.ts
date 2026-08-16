import {
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from './types/index.ts'

import type {
  AbstractSessionModel,
  SessionWithAddTracks,
  TrackContainer,
} from './types/index.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Whether the target track list currently displays any of the track's
 * assemblies, i.e. the track can be shown there after adding it.
 */
export function containerDisplaysAssembly(
  container: { assemblyNames?: readonly string[] } | undefined,
  assemblyNames: readonly (string | undefined)[] | undefined,
) {
  return !!container?.assemblyNames?.some(a => assemblyNames?.includes(a))
}

/** the slice of the add-track widget every workflow's submit path writes to */
export interface AddTrackWidgetSelf extends IStateTreeNode {
  /**
   * Where a submitted track opens: the view, or one track list within it when
   * the widget was opened from a synteny level's track selector. Not the same
   * as `view` — a workflow reaching past this for `view` adds the track to the
   * wrong list.
   */
  trackContainer: TrackContainer | undefined
  clearData: () => void
}

/**
 * Reset the form and dismiss the widget after a successful add.
 *
 * Only ever on an add that landed something: finishing throws away what the
 * user assembled, so doing it when every config was rejected buries the
 * snackbars explaining why behind an empty form with nothing to retry from.
 */
export function finishAddTrack(
  model: AddTrackWidgetSelf,
  session: AbstractSessionModel,
) {
  model.clearData()
  if (isSessionModelWithWidgets(session)) {
    session.hideWidget(model)
  }
}

/**
 * Add one track config from an add-track workflow, reveal it, and dismiss the
 * widget — the tail every workflow shares, so all of them decide "show vs.
 * warn vs. dismiss" the same way.
 *
 * Three things a workflow doing this by hand has got wrong:
 *
 * - It shows the track in `model.view`, which is the wrong list when the widget
 *   was opened from a synteny level's track selector. `trackContainer` is the
 *   target.
 * - It shows a track whose assembly the container doesn't display, which is
 *   silently nothing on screen. Say so instead.
 * - It dismisses the widget even when `addTrackConf` rejected the config,
 *   wiping the form behind the error snackbar.
 *
 * Returns the added config, or undefined when `addTrackConf` rejected it — it
 * has already surfaced its own error, and a second, vaguer snackbar on top of
 * that helps nobody.
 */
export function addTrackFromWidget({
  model,
  session,
  conf,
}: {
  model: AddTrackWidgetSelf
  session: AbstractSessionModel
  conf: Parameters<SessionWithAddTracks['addTrackConf']>[0] & {
    trackId: string
    name?: string
    assemblyNames?: (string | undefined)[]
  }
}) {
  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  }
  const added = session.addTrackConf(conf)
  if (!added) {
    return undefined
  }
  const { trackContainer } = model
  if (containerDisplaysAssembly(trackContainer, conf.assemblyNames)) {
    trackContainer?.showTrack(conf.trackId)
  } else {
    const assemblies = conf.assemblyNames?.filter(a => !!a) ?? []
    session.notify(
      `Added track "${conf.name ?? conf.trackId}" to the session, but it was not displayed because it uses ${
        assemblies.length
          ? `assembly "${assemblies.join('", "')}"`
          : 'an assembly'
      }, which is not open in this view. Open a view for that assembly and use its track selector to display it.`,
      'warning',
    )
  }
  finishAddTrack(model, session)
  return added
}
