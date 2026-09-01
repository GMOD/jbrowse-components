import { makeStyles } from '@jbrowse/core/util/tss-react'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import SyncProblemIcon from '@mui/icons-material/SyncProblem'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { rowLabels } from '../rowLabel.ts'

import type { FollowReport } from '../../SyntenyFollow/followHost.ts'
import type { LinearComparativeViewModel } from '../model.ts'

// No height, and `fontSize="small"` on the icons below: this is the same MUI
// ToggleButton as ScrollZoomToggle beside it, which reaches 31px square — the
// size of every other button in the bar — from `size="small"` and a small icon.
// A pinned 44 and a default-size glyph made this the one control standing 13px
// taller than its neighbours and 6px above their top edge, which reads as a
// misalignment rather than as emphasis.
const useStyles = makeStyles()({
  button: {
    border: 'none',
    textTransform: 'none',
  },
})

/**
 * The tooltip, given the state. Pure so the wording is testable without a
 * render, and separate because it is the only place the mode explains itself
 * outside a menu.
 *
 * A level with no synteny track comes first: it is the state a freshly built
 * view is in, and with nothing to follow by every other sentence is untrue.
 *
 * The unaligned case is the one that most needs saying after that. Over a
 * haplotype-specific insertion or a centromere there is nothing to follow, so
 * the other rows hold position — and a row that stops tracking with nothing
 * said looks exactly like a broken follow.
 *
 * The approximate case yields to it, since a row that is holding was never
 * placed at all, and beats "click to stop", since nothing else in the view
 * distinguishes a proportional placement from a walked one.
 *
 * `anchorLabel` is the row's label rather than its bare assembly name: a stack
 * can hold one assembly twice, and "Following hg38" says nothing there.
 */
export function followToggleTitle({
  followSynteny,
  unaligned,
  approximate,
  noSyntenyTrack,
  partial,
  anchorLabel,
  rows = 2,
}: Partial<FollowReport> & {
  followSynteny: boolean
  anchorLabel?: string
  rows?: number
}) {
  if (rows < 2) {
    return 'Add a second row to follow the anchor through the alignment'
  }
  if (!followSynteny) {
    return 'Follow - other rows track the anchor through the alignment'
  }
  const anchor = anchorLabel ?? 'the anchor row'
  if (noSyntenyTrack) {
    return `Following ${anchor} — a level has no synteny track, so its row has nothing to follow by`
  }
  if (unaligned) {
    return `Following ${anchor} — nothing aligns here, so the other rows are holding`
  }
  // Ahead of `approximate`, which is the normal condition of a zoomed-out view
  // and so says less: this one is the reader's question about a row that is not
  // showing everything the anchor aligns to. It NAMES BOTH SIDES, because the
  // way to see the other answer is to scroll the anchor onto the region that
  // carries it — no button, no undo, just the row they are already driving —
  // and the only thing they cannot do is guess that region is there.
  if (partial?.elsewhere.length) {
    return `Following ${anchor} on ${partial.following} — ${partial.elsewhere.join(', ')} aligns too far away to show at once, so scroll onto it to follow that instead`
  }
  if (approximate) {
    return `Following ${anchor} — no per-base alignment at this zoom, so positions are approximate`
  }
  return `Following ${anchor} — click to stop`
}

/**
 * Follow on/off, in the header rather than only in a menu.
 *
 * A MODE THAT MOVES A ROW THE USER DID NOT TOUCH should not be visible only
 * from inside the menu that set it. Following is the one setting in this view
 * whose effect arrives as motion nobody asked for, seconds after a pan, and a
 * session can arrive with it already on — buried in a submenu, a row that keeps
 * re-placing itself reads as a bug rather than as a setting.
 *
 * TWO STATES, not the three the setting has. `linkViews` is the other coupling
 * and stays in the menu: it is a preference someone sets once, while this is the
 * one worth flicking on and off against a locus. A three-way cycle here was the
 * obvious way to cover both and was worse than either — a ToggleButton reads as
 * on/off, so a third state makes "selected" ambiguous and leaves the tooltip as
 * the only way to tell which coupling is running. Turning this on clears
 * `linkViews` (setRowSyncMode), so the two can still never fight.
 */
const FollowSyntenyToggle = observer(function FollowSyntenyToggle({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { followSynteny, followReport, views, followAnchorIndex } = model
  // the icon, not only the wording, for the two states in which the rows are
  // not moving at all; approximate is the normal condition of a zoomed-out
  // view, and an icon lit most of the time reports nothing
  const stalled =
    followSynteny && (followReport.unaligned || followReport.noSyntenyTrack)
  return (
    <Tooltip
      title={followToggleTitle({
        followSynteny,
        ...followReport,
        anchorLabel: rowLabels(views)[followAnchorIndex],
        rows: views.length,
      })}
    >
      {/* a disabled button fires no pointer events, so the tooltip needs an
        element around it that does */}
      <span>
        <ToggleButton
          // The button's only stable handle: everything else about it is the
          // tooltip, whose wording is a function of the report.
          data-testid="follow-synteny-toggle"
          value="followSynteny"
          selected={followSynteny}
          disabled={views.length < 2}
          onChange={() => {
            model.setRowSyncMode(followSynteny ? 'independent' : 'follow')
          }}
          className={classes.button}
          size="small"
        >
          {stalled ? (
            <SyncProblemIcon fontSize="small" />
          ) : (
            <SyncAltIcon fontSize="small" />
          )}
        </ToggleButton>
      </span>
    </Tooltip>
  )
})

export default FollowSyntenyToggle
