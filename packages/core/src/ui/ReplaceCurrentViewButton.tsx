import { Button } from '@mui/material'

/**
 * The second way out of a launch dialog: put the view it builds in the slot the
 * launching view occupies instead of appending it below. Offered by every launch
 * that is anchored on what the current view is already showing — the synteny
 * launches, "read vs ref" — where keeping both leaves two views of one place
 * stacked and the taller of the two below the fold.
 *
 * Lives here rather than in one of those plugins because the gotcha it exists to
 * carry belongs to `SubmitForm`, which is also here: an extra action is rendered
 * inside that form, where an unset `type` means submit and one click would run
 * BOTH actions.
 *
 * Pair it with `isSessionWithViewReplacement` — a session that cannot replace a
 * view should not be offered the choice.
 */
export default function ReplaceCurrentViewButton({
  disabled,
  onClick,
}: {
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="contained"
      color="primary"
      disabled={disabled}
      onClick={() => {
        onClick()
      }}
    >
      Replace current view
    </Button>
  )
}
