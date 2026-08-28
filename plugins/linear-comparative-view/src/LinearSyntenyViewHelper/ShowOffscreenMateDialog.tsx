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
 * could not do is tell the reader what they were about to lose BEFORE they lost
 * it: a snackbar is missed, dismissed, or read after the fact, by which time
 * the region list it would restore is no longer the one on screen.
 *
 * WHAT IS ABOUT TO BE REPLACED is therefore the content, not the destination.
 * The destination was already legible — the tooltip names the contig and the
 * count, and this repeats them for a reader who arrived by keyboard — while the
 * cost was legible nowhere.
 */
const ShowOffscreenMateDialog = observer(function ShowOffscreenMateDialog({
  model,
  refName,
  side,
  loc,
  replacing,
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
  onConfirm: () => void
  handleClose: () => void
}) {
  const count = offscreenMateCount(model, refName, side)
  const shown =
    replacing.length > MAX_NAMED_REGIONS
      ? `${replacing.length.toLocaleString()} regions`
      : replacing.join(', ')
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
          ? `${count.toLocaleString()} alignments on this band go to ${refName}, which the ${side === 'top' ? 'panel below' : 'panel above'} is not showing.`
          : `${refName} is not shown on the ${side === 'top' ? 'panel below' : 'panel above'}.`}
      </Typography>
      <Typography>Showing it there navigates that panel to {loc}.</Typography>
      {replacing.length > 0 ? (
        <Typography color="warning.main">
          That replaces what the panel is showing now ({shown}). You can undo
          it.
        </Typography>
      ) : null}
    </ConfirmDialog>
  )
})

export default ShowOffscreenMateDialog
