import { namesTemporaryAssembly } from './temporaryAssembly.ts'
import { isSameAssemblyName } from './tracks.ts'
import {
  isSessionModelWithWidgets,
  isSessionWithPublishTrackConf,
} from './types/index.ts'

import type { AssemblyNameResolver } from './tracks.ts'
import type {
  AbstractSessionModel,
  SessionWithPublishTrackConf,
  TrackContainer,
} from './types/index.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Whether the target track list currently displays any of the track's
 * assemblies, i.e. the track can be shown there after adding it.
 *
 * Both sides resolve through the aliases, because the two names meeting here
 * come from different places: the container holds whatever the session opened
 * the view on, and the config holds whatever its author wrote. `===` read a
 * track configured against `hg38` as undisplayable in a view on `GRCh38`, so
 * the add landed and nothing appeared, under a snackbar naming the assembly the
 * user was looking at as one this view does not have open.
 */
export function containerDisplaysAssembly(
  container: { assemblyNames?: readonly string[] } | undefined,
  assemblyNames: readonly (string | undefined)[] | undefined,
  assemblyManager: AssemblyNameResolver,
) {
  return !!container?.assemblyNames?.some(a =>
    assemblyNames?.some(b => isSameAssemblyName(a, b, assemblyManager)),
  )
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
 * The slice of the add-track widget a whole workflow gets: the submit path
 * above plus the assembly it writes into. Structural rather than the widget's
 * own model type, so a plugin contributing a workflow doesn't take a package
 * dependency on the plugin that owns the widget.
 */
export interface AddTrackWorkflowModel extends AddTrackWidgetSelf {
  assembly: string | undefined
  setAssembly: (arg: string) => void
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
 * - It dismisses the widget even when `publishTrackConf` rejected the config,
 *   wiping the form behind the error snackbar.
 *
 * **A track on an assembly the view synthesized takes neither destination.** The
 * widget reads its assembly off the containing view and offers no choice of one
 * outside it (`setAssembly` lists `session.assemblyNames`, which excludes the
 * temporary ones), so a user opening a file in a read-vs-ref panel arrives here
 * naming an assembly that goes back when that view closes — and a session list
 * would keep the config, once per file, in the snapshot they save and share.
 * That is ADR-084's leak reached through the widget rather than through a
 * launcher, so it takes ADR-084's answer: the config rides on the track as
 * `showTrack`'s `inlineConf`, works for the life of the view, and goes out with
 * it. The container is the one this assembly came from, so it displays it.
 *
 * Returns the added config, or undefined when `publishTrackConf` rejected it — it
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
  conf: Parameters<SessionWithPublishTrackConf['publishTrackConf']>[0] & {
    trackId: string
    name?: string
    assemblyNames?: (string | undefined)[]
  }
}) {
  if (!isSessionWithPublishTrackConf(session)) {
    throw new Error("Can't add tracks to this session")
  }
  const { trackContainer } = model
  if (namesTemporaryAssembly(session, conf)) {
    if (!trackContainer) {
      session.notify(
        `Could not add "${conf.name ?? conf.trackId}": the view it was being added to has closed, and it uses an assembly that only that view had.`,
        'warning',
      )
      return undefined
    }
    trackContainer.showTrack(conf.trackId, {}, {}, conf)
    finishAddTrack(model, session)
    return conf
  }
  const added = session.publishTrackConf(conf)
  if (!added) {
    return undefined
  }
  if (
    containerDisplaysAssembly(
      trackContainer,
      conf.assemblyNames,
      session.assemblyManager,
    )
  ) {
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
