// deep subpaths, never the `@jbrowse/core/ui` barrel, which a comparative
// display's first load would otherwise pull whole
import ProgressChip from '@jbrowse/core/ui/ProgressChip'
import DisplayLoadingOverlay from '@jbrowse/display-kit/DisplayLoadingOverlay'
import { useChromeOverlayOverride } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import type { DisplayChromeOverlays } from '@jbrowse/display-ui'

/**
 * What the shared status reads: `ComparativeFetchMixin`'s `loading` and
 * `refetching`, plus the status channel. The last three are the overlay's two
 * buttons, required here where `DisplayLoadingOverlayModel` has them optional,
 * so a display cannot lose its Cancel and Retry by composing the wrong thing.
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

// JBrowse's own look. `Loading` is the LGV chrome's binding. The chip is bound
// here because it anchors itself: no chrome owns a corner for it to sit in.
const muiStatus: Pick<DisplayChromeOverlays, 'Loading' | 'BackgroundProgress'> =
  {
    Loading: DisplayLoadingOverlay,
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
 * The overlay is mounted unconditionally and gates on `visible` itself: its
 * anti-flash delay is component state, so mounting it only while loading would
 * restart the timer on every activation. `immediate` because `loading` is
 * `!fetchLanded`, always a first load with nothing on screen to flash over.
 *
 * The error banner is not here. Dotplot raises one per display; synteny stacks
 * every display's error with the level's GPU error into one banner on the
 * shared canvas, whose Retry has to undo whichever failed. `loading` and
 * `refetching` both subtract `error` on the model, so an errored display
 * renders neither of these.
 *
 * Both states go through the bring-your-own seam: they are two of the five
 * `DisplayChromeOverlays` entries, and `ComparativeStatusModel` satisfies both
 * model shapes structurally.
 */
const ComparativeFetchStatus = observer(function ComparativeFetchStatus({
  display,
}: {
  display: ComparativeStatusModel
}) {
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
