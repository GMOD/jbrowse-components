import { LoadingOverlay, ProgressChip } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

/**
 * What the shared status reads. The three getters are
 * `SyntenyFetchStateMixin`'s vocabulary (see there for why `loading` and
 * `refetching` are different questions), plus the status channel every display
 * reports progress through.
 */
export interface ComparativeStatusModel {
  loading: boolean
  refetching: boolean
  statusMessage?: string
  statusProgress?: number
}

/**
 * The per-display fetch status for the two comparative views, in one component
 * so they cannot drift on what a first load looks like.
 *
 * They had drifted. Synteny rendered the shared striped `LoadingOverlay` plus a
 * corner `ProgressChip`; dotplot hand-rolled a centred `LoadingProgress` in a
 * local `makeStyles` and chained the three states as a JSX ternary — the
 * "re-encode the precedence in render order" shape `computeDisplayPhase` exists
 * to retire on the LGV side. Same model getters, same three states, two
 * different first-load appearances.
 *
 * The overlay is mounted unconditionally and gates on `isVisible` itself, which
 * is load-bearing: its anti-flash delay is component state, so mounting it only
 * while loading restarts the timer on every activation and the delay never
 * elapses. Same rule the LGV chrome's overlay set carries. The chip has no such
 * timer and is mounted conditionally.
 *
 * `immediate` because `loading` is `!ready` — always a first load, with nothing
 * on screen for the indicator to flash over.
 *
 * **The error banner is deliberately not here.** Dotplot raises one per display;
 * synteny stacks every display's error together with the level's GPU error into
 * a single banner on the shared canvas, because one canvas serves the whole
 * band and its Retry has to undo whichever failed. The precedence still holds
 * without it: `loading` and `refetching` both subtract `error` on the model, so
 * an errored display renders neither of these regardless of where its banner
 * lives.
 */
const ComparativeFetchStatus = observer(function ComparativeFetchStatus({
  display,
}: {
  display: ComparativeStatusModel
}) {
  const { loading, refetching, statusMessage, statusProgress } = display
  return (
    <>
      <LoadingOverlay
        statusMessage={statusMessage}
        progress={statusProgress}
        isVisible={loading}
        immediate
      />
      {refetching ? (
        <ProgressChip
          status={{ message: statusMessage, fraction: statusProgress }}
        />
      ) : null}
    </>
  )
})

export default ComparativeFetchStatus
