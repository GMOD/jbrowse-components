// deep subpaths, never the `@jbrowse/core/ui` barrel: one named import of it
// lands FileSelector, FatalErrorDialog, the cascading-menu stack and
// PluginManager in whatever chunk reaches this, and a comparative display's
// first load reaches it. Same rule the LGV overlay bindings carry.
import LoadingOverlay from '@jbrowse/core/ui/LoadingOverlay'
import ProgressChip from '@jbrowse/core/ui/ProgressChip'
import { useChromeOverlayOverride } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import type { DisplayChromeOverlays } from '@jbrowse/display-ui'

/**
 * What the shared status reads. The getters are `SyntenyFetchStateMixin`'s
 * vocabulary (see there for why `loading` and `refetching` are different
 * questions), plus the status channel every display reports progress through.
 *
 * The last three are the overlay's two buttons, and they are **required** where
 * `DisplayLoadingOverlayModel` has them optional: that interface is written for
 * any display anywhere, while both models this one describes compose
 * `SyntenyFetchStateMixin` and so have all three. Optional here would let a
 * display lose its Cancel and its Retry by composing the wrong thing, and the
 * only symptom is a button nobody can find.
 */
export interface ComparativeStatusModel {
  loading: boolean
  refetching: boolean
  statusMessage?: string
  statusProgress?: number
  fetchCanceled: boolean
  cancelFetchByUser: () => void
  reload: () => void
}

// JBrowse's own look, and the only reason this module reaches Material UI.
// Module scope so the identities are stable across renders.
//
// These are the same two entries `DisplayChromeOverlays` already declares, bound
// here rather than imported from `plugin-linear-genome-view`'s bindings, which a
// package cannot depend on. Thin enough that the duplication is the adapter and
// not the behaviour — everything either one does is in core's components.
const muiStatus: Pick<DisplayChromeOverlays, 'Loading' | 'BackgroundProgress'> =
  {
    Loading: observer(function Loading({ model, visible, immediate }) {
      return (
        <LoadingOverlay
          statusMessage={model.statusMessage}
          progress={model.statusProgress}
          isVisible={visible}
          immediate={immediate}
          // The cancel and the retry. This binding passed neither for as long
          // as it existed, which is what made these the only two displays with
          // no way to stop a slow load — the component supported both the whole
          // time. Guarded because the props here are typed against
          // `DisplayLoadingOverlayModel`, where they are optional and undefined
          // means "draw no button"; `ComparativeStatusModel` requires all
          // three, so both comparative displays always pass them. Same three
          // lines as the LGV set's `DisplayLoadingOverlay`.
          canceled={model.fetchCanceled}
          onCancel={
            model.cancelFetchByUser
              ? () => model.cancelFetchByUser?.()
              : undefined
          }
          onRetry={model.reload ? () => model.reload?.() : undefined}
        />
      )
    }),
    BackgroundProgress: observer(function BackgroundProgress({
      model,
      visible,
    }) {
      return visible ? (
        <ProgressChip
          status={{
            message: model.statusMessage,
            fraction: model.statusProgress,
          }}
        />
      ) : null
    }),
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
 *
 * **It goes through the bring-your-own seam**, like every LGV display, so an
 * embedder who mounted `DisplayUIProvider` gets their components here too. That
 * needed no new contract: these are two of the five `DisplayChromeOverlays`
 * entries, and `ComparativeStatusModel` already satisfies both of their model
 * shapes structurally. The other three are terminal and error states these views
 * own themselves, per the paragraph above.
 *
 * The Cancel and Retry buttons ride that seam for free, and this one binding is
 * the only place either view draws them: `DisplayLoadingOverlayModel` already
 * declared `fetchCanceled` / `cancelFetchByUser` / `reload`, so a host's own set
 * reads them off the same model with nothing added on either side.
 */
const ComparativeFetchStatus = observer(function ComparativeFetchStatus({
  display,
}: {
  display: ComparativeStatusModel
}) {
  // The whole five-entry set, or undefined for "nobody asked"; these are the two
  // this renders. Until 2026-08 the override never reached here and nothing said
  // so — the BYO site's census counts what is on screen once a page settles, and
  // this draws during a load.
  const { Loading, BackgroundProgress } =
    useChromeOverlayOverride() ?? muiStatus
  const { loading, refetching } = display
  return (
    <>
      <Loading model={display} visible={loading} immediate />
      <BackgroundProgress model={display} visible={refetching} />
    </>
  )
})

export default ComparativeFetchStatus
