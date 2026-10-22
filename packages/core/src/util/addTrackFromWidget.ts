import { transaction } from 'mobx'

import { coarseStripHTML } from './coarseStripHTML.ts'
import { namesTemporaryAssembly } from './temporaryAssembly.ts'
import { isSameAssemblyName } from './tracks.ts'
import {
  isSessionModelWithWidgets,
  isSessionWithPublishTrackConf,
} from './types/index.ts'

import type { WorkflowFormHost } from './addTrackComponent.ts'
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
export interface AddTrackWorkflowModel
  extends AddTrackWidgetSelf, WorkflowFormHost {
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

export type WidgetTrackConf = Parameters<
  SessionWithPublishTrackConf['publishTrackConf']
>[0] & {
  trackId: string
  name?: string
  assemblyNames?: (string | undefined)[]
}

function describeTracks(confs: WidgetTrackConf[]) {
  const [first] = confs
  return confs.length === 1 && first
    ? `track "${coarseStripHTML(first.name ?? first.trackId)}"`
    : `${confs.length} tracks`
}

function notDisplayedMessage(confs: WidgetTrackConf[]) {
  const one = confs.length === 1
  const assemblies = [
    ...new Set(confs.flatMap(c => c.assemblyNames ?? []).filter(a => !!a)),
  ]
  const which = assemblies.length
    ? `assembly "${assemblies.join('", "')}"`
    : 'an assembly'
  return `Added ${describeTracks(confs)} to the session, but ${one ? 'it was' : 'they were'} not displayed because ${one ? 'it uses' : 'they use'} ${which}, which is not open in this view. Open a view for that assembly and use its track selector to display ${one ? 'it' : 'them'}.`
}

/**
 * Add track configs from an add-track workflow, reveal them, and dismiss the
 * widget — the tail every workflow shares, so all of them decide "show vs.
 * warn vs. dismiss" the same way:
 *
 * - The target is `model.trackContainer`, not `model.view`, which is the wrong
 *   list when the widget was opened from a synteny level's track selector.
 * - A track whose assembly the container doesn't display is added and named in
 *   a warning, rather than shown as nothing.
 * - The widget is dismissed only when at least one config landed; one that
 *   `publishTrackConf` rejected has already surfaced its own error.
 * - **A track on an assembly the view synthesized takes neither session list.**
 *   That assembly goes back when the view closes, so a list entry would outlive
 *   it in every saved session (ADR-084). The config rides on the track as
 *   `launchTrack`'s `inlineConf` instead.
 *
 * The publishes run in one transaction, so a batch re-renders the track
 * selector once. The shows follow in order, each awaiting its display's state
 * model; `shown` settles when the last one has opened.
 */
export function addTracksFromWidget({
  model,
  session,
  confs,
}: {
  model: AddTrackWidgetSelf
  session: AbstractSessionModel
  confs: WidgetTrackConf[]
}) {
  if (!isSessionWithPublishTrackConf(session)) {
    throw new Error("Can't add tracks to this session")
  }
  const { trackContainer } = model
  const added: WidgetTrackConf[] = []
  const toShow: { conf: WidgetTrackConf; inline: boolean }[] = []
  const notDisplayed: WidgetTrackConf[] = []
  const viewClosed: WidgetTrackConf[] = []
  transaction(() => {
    for (const conf of confs) {
      if (namesTemporaryAssembly(session, conf)) {
        if (trackContainer) {
          added.push(conf)
          toShow.push({ conf, inline: true })
        } else {
          viewClosed.push(conf)
        }
      } else if (session.publishTrackConf(conf)) {
        added.push(conf)
        if (
          containerDisplaysAssembly(
            trackContainer,
            conf.assemblyNames,
            session.assemblyManager,
          )
        ) {
          toShow.push({ conf, inline: false })
        } else {
          notDisplayed.push(conf)
        }
      }
    }
  })
  if (viewClosed.length) {
    session.notify(
      `Could not add ${describeTracks(viewClosed)}: the view ${viewClosed.length === 1 ? 'it was' : 'they were'} being added to has closed, and ${viewClosed.length === 1 ? 'it uses' : 'they use'} an assembly that only that view had.`,
      'warning',
    )
  }
  if (notDisplayed.length) {
    session.notify(notDisplayedMessage(notDisplayed), 'warning')
  }
  if (added.length) {
    finishAddTrack(model, session)
  }
  const shown = (async () => {
    for (const { conf, inline } of toShow) {
      await (inline
        ? trackContainer?.launchTrack(conf.trackId, {}, {}, conf)
        : trackContainer?.launchTrack(conf.trackId))
    }
  })()
  return { added, shown }
}

/**
 * `addTracksFromWidget` for one config. Returns the config, or undefined when
 * it was not added.
 */
export function addTrackFromWidget({
  model,
  session,
  conf,
}: {
  model: AddTrackWidgetSelf
  session: AbstractSessionModel
  conf: WidgetTrackConf
}) {
  return addTracksFromWidget({ model, session, confs: [conf] }).added[0]
}
