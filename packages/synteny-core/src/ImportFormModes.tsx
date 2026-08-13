import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ImportFormModeToggle from './ImportFormModeToggle.tsx'
import QuickStartPanel from './QuickStartPanel.tsx'

import type { useQuickStartState } from './useQuickStartState.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  toggle: {
    marginBottom: theme.spacing(2),
  },
}))

/**
 * The Quick start / Manual split both comparative import forms are built
 * around: the mode toggle, the Quick start panel, and the handover between
 * them. Only the manual half differs between the views (a stack of assembly
 * rows for synteny, two axis selectors for a dotplot), so that is `children`.
 *
 * What this really owns is the handover. Switching to Manual copies over what
 * Quick start had set up — but only when Quick start actually has a track, or
 * "Manual" would reset a form the user was already filling in to a track that
 * isn't there. Both forms spelled that guard out separately, and it is the kind
 * of condition that is only ever wrong in one of two copies.
 *
 * Deliberately not here: the surrounding Container, the error banner and the
 * launch/catch. The surface each view wants genuinely differs (a dotplot form
 * is a narrow centred card, a synteny form a wide two-column block), and
 * pulling it in would mean a prop that only exists to remember which is which.
 */
const ImportFormModes = observer(function ImportFormModes({
  model,
  quick,
  onHandoverToManual,
  onQuickLaunch,
  swapTitle,
  quickSummary,
  children,
}: {
  model: IStateTreeNode
  quick: ReturnType<typeof useQuickStartState>
  /**
   * copy Quick start's chosen track into the manual form's own state. Called
   * only when there is a track to hand over, so it never has to check.
   */
  onHandoverToManual: () => void
  /** apply Quick start's selections and submit */
  onQuickLaunch: () => void
  swapTitle: string
  /** the view's summary of the assemblies the chosen track implies */
  quickSummary: React.ReactNode
  /** the manual form */
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <>
      <div className={classes.toggle}>
        <ImportFormModeToggle
          mode={quick.mode}
          onChange={newMode => {
            // `newMode !== quick.mode`: re-clicking the mode already showing is
            // how the user latches a derived one, and it must not also hand the
            // form over — that would reset what they had already filled in to
            // the Quick start track's rows.
            if (newMode === 'manual' && newMode !== quick.mode && quick.track) {
              onHandoverToManual()
            }
            quick.setMode(newMode)
          }}
        />
      </div>
      {quick.mode === 'quick' ? (
        <QuickStartPanel
          model={model}
          tracks={quick.quickTracks}
          trackId={quick.trackId}
          onChange={newTrackId => {
            quick.setTrackId(newTrackId)
          }}
          onSwap={() => {
            quick.swap()
          }}
          onSwitchToManual={() => {
            quick.setMode('manual')
          }}
          onLaunch={() => {
            onQuickLaunch()
          }}
          swapTitle={swapTitle}
        >
          {quickSummary}
        </QuickStartPanel>
      ) : (
        children
      )}
    </>
  )
})

export default ImportFormModes
