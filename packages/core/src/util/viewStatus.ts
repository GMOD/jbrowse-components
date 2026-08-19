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
