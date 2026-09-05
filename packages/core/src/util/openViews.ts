import type {
  AbstractSessionModel,
  AbstractTrackModel,
  AbstractViewModel,
} from './types/index.ts'

/**
 * What a view declares it holds, as the runtime can actually find it.
 *
 * `AbstractViewModel` requires both, and a view plugin built against a core
 * older than they are satisfies that interface at compile time and not at run
 * time. Optional here so the absence is handled rather than asserted away:
 * under-reporting costs a census entry, throwing costs the session, and the
 * session is what this whole contract exists to protect.
 */
interface Declared {
  ownViews?: AbstractViewModel[]
  ownTracks?: AbstractTrackModel[]
}

/**
 * "What is open" — the reduction four consumers wanted and each used to walk
 * for itself (AppReadyMarker, jbApi, and capture's session gate and busy
 * check), on different and drifting spellings of the view nesting.
 *
 * The recursion lives here, once. What each view contributes lives on the view,
 * once, as `ownViews`/`ownTracks`. Neither half guesses at the other: the
 * census is declared intent, not a shape that can be discovered, because the
 * two things that look enumerable are not — the dotplot's `views` prop holds
 * view-shaped axis models the user never opened, and react-msaview's `tracks`
 * getter holds annotation rows that are not tracks.
 */
export function openViews(session: AbstractSessionModel): AbstractViewModel[] {
  return session.views.flatMap(withNested)
}

/** Every track on every open view. */
export function openTracks(
  session: AbstractSessionModel,
): AbstractTrackModel[] {
  return openViews(session).flatMap(v => (v as Declared).ownTracks ?? [])
}

function withNested(view: AbstractViewModel): AbstractViewModel[] {
  return [view, ...((view as Declared).ownViews ?? []).flatMap(withNested)]
}
