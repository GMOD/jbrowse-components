import { makeStyles } from '@jbrowse/core/util/tss-react'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import SyncProblemIcon from '@mui/icons-material/SyncProblem'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

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
 * The unaligned case is the one that most needs saying. Over a
 * haplotype-specific insertion or a centromere there is nothing to follow, so
 * the other rows hold position — and a row that stops tracking with nothing
 * said looks exactly like a broken follow.
 *
 * The approximate case yields to it, since a row that is holding was never
 * placed at all, and beats "click to stop", since nothing else in the view
 * distinguishes a proportional placement from a walked one.
 */
export function followToggleTitle({
  followSynteny,
  unaligned,
  approximate,
  anchorAssembly,
}: {
  followSynteny: boolean
  unaligned?: boolean
  approximate?: boolean
  anchorAssembly?: string
}) {
  if (!followSynteny) {
    return 'Follow the matching region'
  }
  const anchor = anchorAssembly ?? 'the anchor row'
  if (unaligned) {
    return `Following ${anchor} — nothing aligns here, so the other rows are holding`
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
  const {
    followSynteny,
    followUnaligned,
    followApproximate,
    views,
    followAnchorIndex,
  } = model
  const stalled = followSynteny && followUnaligned
  return (
    <Tooltip
      title={followToggleTitle({
        followSynteny,
        unaligned: followUnaligned,
        // wording, not a second icon state: approximate is the normal condition
        // of a zoomed-out view, and an icon lit most of the time reports nothing
        approximate: followApproximate,
        anchorAssembly: views[followAnchorIndex]?.assemblyNames[0],
      })}
    >
      <ToggleButton
        // The button's only stable handle: everything else about it is the
        // tooltip, whose wording is a function of four pieces of state.
        data-testid="follow-synteny-toggle"
        value="followSynteny"
        selected={followSynteny}
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
    </Tooltip>
  )
})

export default FollowSyntenyToggle
