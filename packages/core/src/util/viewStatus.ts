/**
 * The mutually-exclusive lifecycle state of a view, as one value.
 *
 * A view answers this question through nine getters today — `ready`, `error`,
 * `initialized`, `showLoading`, `showImportForm`, `hasSomethingToShow`,
 * `loadingMessage`, `loadingProgress`, `assemblyErrors` — and a host reading
 * them has to re-derive the precedence by subtraction, which is the mistake
 * `computeDisplayPhase` was written to stop one level down. `view.ready` **is**
 * that subtraction: `!showLoading && !this.error`.
 *
 * The payload travels with the branch, so a caller cannot read a loading
 * message out of a failed view or an error out of a healthy one.
 */
export type ViewStatus =
  | { type: 'ready' }
  | { type: 'error'; error: unknown }
  | { type: 'loading'; message: string; progress: number | undefined }
  | { type: 'noRegions' }

export interface ViewStatusInputs {
  error: unknown
  /**
   * Whether anything has told the view where to look — displayed regions, or an
   * `init` blob still being applied.
   */
  hasSomethingToShow: boolean
  /**
   * The view's own loading term, as a thunk: `undefined` when it is not
   * loading, otherwise what the spinner should say.
   *
   * A thunk for the same reason `computeDisplayPhase` takes one. The message
   * and the progress fraction come off the assembly's download status, which
   * ticks continuously while a file is in flight — so evaluating it eagerly
   * would make every reader of a *ready* view subscribe to a churning
   * observable it never displays.
   */
  loading: () => { message: string; progress: number | undefined } | undefined
}

/**
 * Precedence is `error` > `noRegions` > `loading` > `ready`, in one place,
 * rather than re-encoded by subtraction in each view and again in each host.
 *
 * **`ready` here is strictly narrower than `view.ready`**, which is the point of
 * having it. That getter is true when nothing has told the view where to look —
 * `showLoading` is false in that state and so is `error` — so a host gating on
 * it mounts track components over a view with no regions and gets an empty box
 * with nothing anywhere saying why. `noRegions` is that state, named.
 */
export function computeViewStatus({
  error,
  hasSomethingToShow,
  loading,
}: ViewStatusInputs): ViewStatus {
  if (error) {
    return { type: 'error', error }
  }
  if (!hasSomethingToShow) {
    return { type: 'noRegions' }
  }
  const pending = loading()
  return pending ? { type: 'loading', ...pending } : { type: 'ready' }
}

/**
 * The slice of `AssemblyManager` this needs, spelled out rather than imported:
 * the real type is an MST model a `PluginManager` built, so naming it here
 * would cost this leaf the whole application's type graph (`util/CLAUDE.md`).
 */
interface AssemblyErrorSource {
  get: (name: string) => { error?: unknown } | undefined
}

/**
 * The assembly failures behind a view's `assemblyNames`, joined, or `undefined`
 * when there are none.
 *
 * **Undefined and not `''`**, which is the whole reason this is shared. Three
 * views spelled it as a bare `.join(', ')`, and a getter that answers the empty
 * string for "nothing failed" reads as an error to every `!== undefined` test —
 * `DotplotView.error` folded it in with `??`, so the view reported a terminal
 * error permanently and jbrowse-img refused to render any dotplot. The in-app
 * readers all happened to be truthiness tests, which is why it stayed invisible.
 */
export function assemblyErrorMessage(
  assemblyManager: AssemblyErrorSource,
  assemblyNames: string[],
) {
  const errors = assemblyNames
    .map(name => assemblyManager.get(name)?.error)
    .filter(e => !!e)
  return errors.length > 0 ? errors.join(', ') : undefined
}
