import { ConfirmDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { offscreenMateCount } from './offscreenMateStrip.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateSource } from './offscreenMateStrip.ts'

// Past this many the list is a wall of names rather than a thing to weigh, and
// the count carries it instead.
const MAX_NAMED_REGIONS = 6

/**
 * The one destructive step in the off-screen mate feature, asked rather than
 * done and then offered back.
 *
 * ONLY THIS CLASS OF MARK. A mate on a contig the facing row already displays
 * is SCROLLED to, which is reversible by scrolling, so a dialog in front of it
 * is friction with nothing to buy. This class has no such path: the row is not
 * displaying the contig at all, so the only way to draw the ribbon is
 * `navToLocString`, which REPLACES that row's displayed regions — a list the
 * reader may have spent several navigations building, and "show all regions" is
 * not an undo for it.
 *
 * The click already offered an Undo snackbar afterwards, and it stays. What it
 * could not do is say what the panel was about to swap out BEFORE it swapped:
 * a snackbar is missed, dismissed, or read after the fact, by which time the
 * region list it would restore is no longer the one on screen.
 *
 * IT EXPLAINS RATHER THAN WARNS. Nothing here is dangerous — the navigation is
 * ordinary, it is undoable, and the reader asked for it — so the copy is the
 * sentence a colleague would say, not an alert. It leads with what the click
 * GIVES (the marks become ribbons, which is also the clearest short answer to
 * "what is this strip"), and the panel's current regions follow as the ordinary
 * consequence they are, in secondary text. A `warning.main` line here read as
 * "you may be about to break something" over an action whose whole cost is one
 * Undo away.
 *
 * WHAT IS SWAPPED OUT is the content, not the destination. The destination was
 * already legible — the tooltip names the contig and the count, and this
 * repeats them for a reader who arrived by keyboard — while the regions the
 * panel would give up were legible nowhere.
 */
const ShowOffscreenMateDialog = observer(function ShowOffscreenMateDialog({
  model,
  refName,
  side,
  loc,
  replacing,
  rowSync,
  onConfirm,
  handleClose,
}: {
  model: OffscreenMateSource
  refName: string
  side: OffscreenMateSide
  // where the row will land, as `navLocString` resolved it — the padded,
  // floored destination rather than the mark's raw span, so the number here is
  // the number the row lands at
  loc: string
  // the row's displayed regions right now, by name and in order
  replacing: string[]
  // how the stack is held together, which decides what the panel NOT being
  // navigated does — see `others` below
  rowSync: 'independent' | 'link' | 'follow'
  onConfirm: () => void
  handleClose: () => void
}) {
  const count = offscreenMateCount(model, refName, side)
  const panel = side === 'top' ? 'panel below' : 'panel above'
  const other = side === 'top' ? 'panel above' : 'panel below'
  const instead =
    replacing.length === 0
      ? ''
      : replacing.length > MAX_NAMED_REGIONS
        ? `, in place of the ${replacing.length.toLocaleString()} regions it is showing now`
        : `, in place of ${listPhrase(replacing)}`
  // WHAT HAPPENS TO THE ROW NOBODY CLICKED, which is the question the copy left
  // open: one panel is named and the other never mentioned, so a reader had no
  // way to tell whether the whole stack was about to move. It depends on the
  // row sync mode, and all three answers are different — under `follow` the
  // click TAKES the anchor, so the others are re-placed onto this row's
  // mapping, which is the whole point of anchoring it.
  const others =
    rowSync === 'follow'
      ? `The ${other} follows it.`
      : rowSync === 'link'
        ? `The ${other} keeps its own regions and shares the zoom.`
        : `The ${other} stays where it is.`
  return (
    <ConfirmDialog
      open
      title={`Show ${refName}?`}
      submitText="Show"
      onSubmit={() => {
        onConfirm()
        handleClose()
      }}
      onCancel={handleClose}
    >
      <Typography>
        {count > 0
          ? `${count.toLocaleString()} alignments on this band point to ${refName}. The ${panel} is not showing it yet, which is why they are marks rather than ribbons.`
          : `The ${panel} is not showing ${refName} yet.`}
      </Typography>
      <Typography color="text.secondary">
        {`The ${panel} navigates to ${loc}${instead}. ${others} You can undo this afterwards.`}
      </Typography>
    </ConfirmDialog>
  )
})

// "ctgA", "ctgA and ctgB", "ctgA, ctgB and ctgC" — a sentence a reader is meant
// to read, rather than a comma-joined field.
function listPhrase(names: string[]) {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : (names[0] ?? '')
}

export default ShowOffscreenMateDialog
